use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::instructions::{
    TransferV1Cpi, TransferV1CpiAccounts, TransferV1InstructionArgs,
};

declare_id!("2T5eYk6cXCJehK5iJy9eQtTgPehDzChYhH1AnSTwWLWq");

/// Marketplace fee in basis points (10000 = 100%). e.g. 250 = 2.5% — sent to static deployment address.
pub const MARKETPLACE_FEE_BPS: u16 = 250;

pub const MARKETPLACE_FEE_RECIPIENT: Pubkey =
    pubkey!("5GLPnCWkDniHq4B7o7K5fsxRKf4xpprX2ENngRs4VGeB");

#[program]
pub mod marketplace {
    use super::*;

    pub fn list_nft(ctx: Context<ListNft>, price: u64, expiry: i64) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.mint = ctx.accounts.mint.key();
        listing.price = price;
        listing.expiry = expiry;
        // Updated bump syntax for Anchor 0.30+
        listing.bump = ctx.bumps.listing;

        // Use Metaplex TransferV1 CPI for pNFT/NFT compatibility (documented pattern)
        let metadata_program_info = ctx.accounts.token_metadata_program.to_account_info();
        let token_info = ctx.accounts.seller_token_account.to_account_info();
        let owner_info = ctx.accounts.seller.to_account_info();
        let destination_token_info = ctx.accounts.escrow_token_account.to_account_info();
        let destination_owner_info = ctx.accounts.listing.to_account_info();
        let mint_info = ctx.accounts.mint.to_account_info();
        let metadata_info = ctx.accounts.metadata.to_account_info();
        let edition_info = ctx.accounts.master_edition.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();
        let sysvar_instructions_info = ctx.accounts.sysvar_instructions.to_account_info();
        let spl_token_program_info = ctx.accounts.token_program.to_account_info();
        let spl_ata_program_info = ctx.accounts.associated_token_program.to_account_info();
        // Documented pattern: TransferV1Cpi::new(program, TransferV1CpiAccounts { ... }, TransferV1InstructionArgs { ... })
        let cpi_transfer = TransferV1Cpi::new(
            &metadata_program_info,
            TransferV1CpiAccounts {
                token: &token_info,
                token_owner: &owner_info,
                destination_token: &destination_token_info,
                destination_owner: &destination_owner_info,
                mint: &mint_info,
                metadata: &metadata_info,
                edition: Some(&edition_info),
                token_record: None,
                destination_token_record: None,
                authority: &owner_info,
                payer: &owner_info,
                system_program: &system_program_info,
                sysvar_instructions: &sysvar_instructions_info,
                spl_token_program: &spl_token_program_info,
                spl_ata_program: &spl_ata_program_info,
                authorization_rules_program: None,
                authorization_rules: None,
            },
            TransferV1InstructionArgs {
                amount: 1,
                authorization_data: None,
            },
        );
        cpi_transfer.invoke()?;

        Ok(())
    }

    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(
            Clock::get()?.unix_timestamp <= listing.expiry,
            ErrorCode::ListingExpired
        );

        let metadata_data = ctx.accounts.metadata.try_borrow_data()?;
        let metadata = mpl_token_metadata::accounts::Metadata::safe_deserialize(&metadata_data)
            .map_err(|_| ErrorCode::InvalidMetadata)?;

        require!(
            ctx.accounts.update_authority_fee_recipient.key() == metadata.update_authority,
            ErrorCode::InvalidFeeRecipient
        );
        drop(metadata_data);
        msg!(
            "update_authority_fee_recipient: {}",
            metadata.update_authority
        );

        let seller_fee_basis_points = metadata.seller_fee_basis_points;

        let fee_marketplace = listing
            .price
            .checked_mul(MARKETPLACE_FEE_BPS as u64)
            .and_then(|v| v.checked_div(10000))
            .ok_or(ErrorCode::FeeOverflow)?;
        let fee_update_authority = listing
            .price
            .checked_mul(seller_fee_basis_points as u64)
            .and_then(|v| v.checked_div(10000))
            .ok_or(ErrorCode::FeeOverflow)?;
        let to_seller = listing
            .price
            .checked_sub(fee_marketplace)
            .and_then(|v| v.checked_sub(fee_update_authority))
            .ok_or(ErrorCode::FeeOverflow)?;

        let sys = ctx.accounts.system_program.to_account_info();

        // buyer → seller
        anchor_lang::system_program::transfer(
            CpiContext::new(
                sys.clone(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
            ),
            to_seller,
        )?;

        // buyer → marketplace fee recipient
        anchor_lang::system_program::transfer(
            CpiContext::new(
                sys.clone(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.marketplace_fee_recipient.to_account_info(),
                },
            ),
            fee_marketplace,
        )?;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                sys.clone(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx
                        .accounts
                        .update_authority_fee_recipient
                        .to_account_info(),
                },
            ),
            fee_update_authority,
        )?;

        // PDA signer seeds for the listing account (acts as escrow authority)
        let seller_key = listing.seller;
        let mint_key = listing.mint;
        let bump = listing.bump;
        let seeds = &[
            b"listing".as_ref(),
            seller_key.as_ref(),
            mint_key.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[seeds.as_slice()];

        // Transfer NFT from escrow to buyer via Metaplex TransferV1 (documented pattern)
        let metadata_program_info = ctx.accounts.token_metadata_program.to_account_info();
        let token_info = ctx.accounts.escrow_token_account.to_account_info();
        let vault_info = ctx.accounts.listing.to_account_info();
        let destination_token_info = ctx.accounts.buyer_token_account.to_account_info();
        let destination_owner_info = ctx.accounts.buyer.to_account_info();
        let mint_info = ctx.accounts.mint.to_account_info();
        let metadata_info = ctx.accounts.metadata.to_account_info();
        let edition_info = ctx.accounts.master_edition.to_account_info();
        let payer_info = ctx.accounts.buyer.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();
        let sysvar_instructions_info = ctx.accounts.sysvar_instructions.to_account_info();
        let spl_token_program_info = ctx.accounts.token_program.to_account_info();
        let spl_ata_program_info = ctx.accounts.associated_token_program.to_account_info();
        // Documented pattern: TransferV1Cpi::new(...); cpi_transfer.invoke_signed(&[&signer_seeds])
        let cpi_transfer = TransferV1Cpi::new(
            &metadata_program_info,
            TransferV1CpiAccounts {
                token: &token_info,
                token_owner: &vault_info,
                destination_token: &destination_token_info,
                destination_owner: &destination_owner_info,
                mint: &mint_info,
                metadata: &metadata_info,
                edition: Some(&edition_info),
                token_record: None,
                destination_token_record: None,
                authority: &vault_info,
                payer: &payer_info,
                system_program: &system_program_info,
                sysvar_instructions: &sysvar_instructions_info,
                spl_token_program: &spl_token_program_info,
                spl_ata_program: &spl_ata_program_info,
                authorization_rules_program: None,
                authorization_rules: None,
            },
            TransferV1InstructionArgs {
                amount: 1,
                authorization_data: None,
            },
        );
        cpi_transfer.invoke_signed(signer_seeds)?;

        Ok(())
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &ctx.accounts.listing;

        require!(
            ctx.accounts.seller.key() == listing.seller,
            ErrorCode::Unauthorized
        );

        let seller_key = listing.seller;
        let mint_key = listing.mint;
        let bump = listing.bump;
        let seeds = &[
            b"listing".as_ref(),
            seller_key.as_ref(),
            mint_key.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[seeds.as_slice()];

        // Return NFT from escrow back to seller via Metaplex TransferV1 (documented pattern)
        let metadata_program_info = ctx.accounts.token_metadata_program.to_account_info();
        let token_info = ctx.accounts.escrow_token_account.to_account_info();
        let vault_info = ctx.accounts.listing.to_account_info();
        let destination_token_info = ctx.accounts.seller_token_account.to_account_info();
        let destination_owner_info = ctx.accounts.seller.to_account_info();
        let mint_info = ctx.accounts.mint.to_account_info();
        let metadata_info = ctx.accounts.metadata.to_account_info();
        let edition_info = ctx.accounts.master_edition.to_account_info();
        let payer_info = ctx.accounts.seller.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();
        let sysvar_instructions_info = ctx.accounts.sysvar_instructions.to_account_info();
        let spl_token_program_info = ctx.accounts.token_program.to_account_info();
        let spl_ata_program_info = ctx.accounts.associated_token_program.to_account_info();
        // Documented pattern: TransferV1Cpi::new(...); cpi_transfer.invoke_signed(&[&signer_seeds])
        let cpi_transfer = TransferV1Cpi::new(
            &metadata_program_info,
            TransferV1CpiAccounts {
                token: &token_info,
                token_owner: &vault_info,
                destination_token: &destination_token_info,
                destination_owner: &destination_owner_info,
                mint: &mint_info,
                metadata: &metadata_info,
                edition: Some(&edition_info),
                token_record: None,
                destination_token_record: None,
                authority: &vault_info,
                payer: &payer_info,
                system_program: &system_program_info,
                sysvar_instructions: &sysvar_instructions_info,
                spl_token_program: &spl_token_program_info,
                spl_ata_program: &spl_ata_program_info,
                authorization_rules_program: None,
                authorization_rules: None,
            },
            TransferV1InstructionArgs {
                amount: 1,
                authorization_data: None,
            },
        );
        cpi_transfer.invoke_signed(signer_seeds)?;

        Ok(())
    }
}

// ── Account structs ──────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ListNft<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = seller,
        space = ListingAccount::LEN,
        seeds = [b"listing", seller.key().as_ref(), mint.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, ListingAccount>,

    /// Seller's ATA for the NFT
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Escrow ATA owned by the listing PDA
    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = listing,
    )]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Metaplex Metadata account for the NFT mint
    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Metaplex Master Edition account
    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    /// Token record for seller (required for pNFTs, Optional for standard NFTs)
    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub seller_token_record: Option<UncheckedAccount<'info>>,

    /// Token record for escrow (required for pNFTs)
    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub escrow_token_record: Option<UncheckedAccount<'info>>,

    /// CHECK: Metaplex Token Metadata program
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    /// CHECK: Required by Metaplex for pNFT transfers
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct BuyNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Seller receives lamports; validated against listing
    #[account(mut, address = listing.seller)]
    pub seller: UncheckedAccount<'info>,

    /// Receives the marketplace fee (static address set at deployment).
    /// CHECK: Validated by address constraint
    #[account(mut, address = MARKETPLACE_FEE_RECIPIENT)]
    pub marketplace_fee_recipient: UncheckedAccount<'info>,

    /// Receives the update authority fee; must be the NFT metadata update authority.
    /// CHECK: Validated in instruction against metadata
    #[account(mut)]
    pub update_authority_fee_recipient: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"listing", listing.seller.as_ref(), mint.key().as_ref()],
        bump = listing.bump,
        close = seller,
    )]
    pub listing: Account<'info, ListingAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = listing,
    )]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    /// CHECK: pNFT token record for escrow
    #[account(mut)]
    pub escrow_token_record: Option<UncheckedAccount<'info>>,

    /// CHECK: pNFT token record for buyer
    #[account(mut)]
    pub buyer_token_record: Option<UncheckedAccount<'info>>,

    /// CHECK: Metaplex Token Metadata program
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    /// CHECK: Sysvar instructions
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"listing", seller.key().as_ref(), mint.key().as_ref()],
        bump = listing.bump,
        has_one = seller,
        close = seller,
    )]
    pub listing: Account<'info, ListingAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = listing,
    )]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    /// CHECK: pNFT token record for escrow
    #[account(mut)]
    pub escrow_token_record: Option<UncheckedAccount<'info>>,

    /// CHECK: pNFT token record for seller
    #[account(mut)]
    pub seller_token_record: Option<UncheckedAccount<'info>>,

    /// CHECK: Metaplex Token Metadata program
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    /// CHECK: Sysvar instructions
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: UncheckedAccount<'info>,
}

// ── State ────────────────────────────────────────────────────────────────────

#[account]
pub struct ListingAccount {
    pub seller: Pubkey, // 32
    pub mint: Pubkey,   // 32
    pub price: u64,     // 8
    pub expiry: i64,    // 8
    pub bump: u8,       // 1
}

impl ListingAccount {
    // discriminator (8) + fields
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("The listing has expired.")]
    ListingExpired,
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("Fee must be between 0 and 10000 basis points (0-100%).")]
    InvalidFee,
    #[msg("Fee calculation overflow.")]
    FeeOverflow,
    #[msg("Fee recipient must be the NFT metadata update authority.")]
    InvalidFeeRecipient,
    #[msg("Invalid metadata account.")]
    InvalidMetadata,
}
