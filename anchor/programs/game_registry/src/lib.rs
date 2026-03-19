use anchor_lang::prelude::*;

// Program id: run `anchor keys sync` to generate and sync with Anchor.toml
declare_id!("4jDnCxk12L9DNAiuMp3ddJYqFgsfpEW7aY4S7m8HFDwx");

/// Replace with your platform authority public key (the only address that can register/update/remove games).
pub const PLATFORM_AUTHORITY: Pubkey = pubkey!("4YLysbxD5DrgS7HHZnny6QsYbfUqjSjnUiJTpiL4Bbp6");

/// Maximum fee percent in basis points (10000 = 100%).
pub const FEE_PERCENT_MAX: u16 = 2000;

/// Maximum length for game name (bytes).
pub const GAME_NAME_MAX_LEN: usize = 64;
/// Maximum length for description (bytes).
pub const DESCRIPTION_MAX_LEN: usize = 700;
/// Maximum length for image URI (bytes).
pub const IMAGE_URI_MAX_LEN: usize = 500;
/// Maximum length for generic URI / website (bytes).
pub const URI_MAX_LEN: usize = 500;
/// Maximum length for category (bytes).
pub const CATEGORY_MAX_LEN: usize = 64;

#[program]
pub mod game_registry {
    use super::*;

    /// Register a game. Only the platform authority can register. One game account per authority.
    /// Seeds: ["game", authority]
    pub fn register_game(
        ctx: Context<RegisterGame>,
        name: String,
        description: Option<String>,
        image_uri: Option<String>,
        uri: Option<String>,
        category: Option<String>,
        fee_recipient: Option<Pubkey>,
        fee_percent_bps: u16,
    ) -> Result<()> {
        require!(
            ctx.accounts.platform_authority.key() == PLATFORM_AUTHORITY,
            GameRegistryError::Unauthorized
        );
        require!(
            fee_percent_bps <= FEE_PERCENT_MAX,
            GameRegistryError::FeePercentTooHigh
        );
        require!(
            name.len() <= GAME_NAME_MAX_LEN,
            GameRegistryError::NameTooLong
        );
        if let Some(ref s) = description {
            require!(
                s.len() <= DESCRIPTION_MAX_LEN,
                GameRegistryError::DescriptionTooLong
            );
        }
        if let Some(ref s) = image_uri {
            require!(
                s.len() <= IMAGE_URI_MAX_LEN,
                GameRegistryError::ImageUriTooLong
            );
        }
        if let Some(ref s) = uri {
            require!(
                s.len() <= URI_MAX_LEN,
                GameRegistryError::UriTooLong
            );
        }
        if let Some(ref s) = category {
            require!(
                s.len() <= CATEGORY_MAX_LEN,
                GameRegistryError::CategoryTooLong
            );
        }

        let game = &mut ctx.accounts.game;
        game.authority = ctx.accounts.authority.key();
        game.name = name;
        game.description = description.unwrap_or_default();
        game.image_uri = image_uri.unwrap_or_default();
        game.uri = uri.unwrap_or_default();
        game.category = category.unwrap_or_default();
        game.fee_recipient = fee_recipient.unwrap_or(ctx.accounts.authority.key());
        game.fee_percent_bps = fee_percent_bps;
        game.bump = ctx.bumps.game;

        msg!("Game registered: authority={}", game.authority);
        Ok(())
    }

    /// Update game metadata. Only the platform authority can update.
    pub fn update_game(
        ctx: Context<UpdateGame>,
        name: Option<String>,
        description: Option<Option<String>>,
        image_uri: Option<Option<String>>,
        uri: Option<Option<String>>,
        category: Option<Option<String>>,
        fee_recipient: Option<Pubkey>,
        fee_percent_bps: Option<u16>,
    ) -> Result<()> {
        require!(
            ctx.accounts.platform_authority.key() == PLATFORM_AUTHORITY,
            GameRegistryError::Unauthorized
        );
        let game = &mut ctx.accounts.game;
        if let Some(n) = name {
            require!(n.len() <= GAME_NAME_MAX_LEN, GameRegistryError::NameTooLong);
            game.name = n;
        }
        if let Some(opt) = description {
            match &opt {
                Some(s) => {
                    require!(
                        s.len() <= DESCRIPTION_MAX_LEN,
                        GameRegistryError::DescriptionTooLong
                    );
                    game.description = s.clone();
                }
                None => game.description = String::new(),
            }
        }
        if let Some(opt) = image_uri {
            match &opt {
                Some(s) => {
                    require!(
                        s.len() <= IMAGE_URI_MAX_LEN,
                        GameRegistryError::ImageUriTooLong
                    );
                    game.image_uri = s.clone();
                }
                None => game.image_uri = String::new(),
            }
        }
        if let Some(opt) = uri {
            match &opt {
                Some(s) => {
                    require!(
                        s.len() <= URI_MAX_LEN,
                        GameRegistryError::UriTooLong
                    );
                    game.uri = s.clone();
                }
                None => game.uri = String::new(),
            }
        }
        if let Some(opt) = category {
            match &opt {
                Some(s) => {
                    require!(
                        s.len() <= CATEGORY_MAX_LEN,
                        GameRegistryError::CategoryTooLong
                    );
                    game.category = s.clone();
                }
                None => game.category = String::new(),
            }
        }
        if let Some(recipient) = fee_recipient {
            game.fee_recipient = recipient;
        }
        if let Some(bps) = fee_percent_bps {
            require!(
                bps <= FEE_PERCENT_MAX,
                GameRegistryError::FeePercentTooHigh
            );
            game.fee_percent_bps = bps;
        }
        Ok(())
    }

    /// Remove (close) a game account. Only the platform authority can remove. Rent goes to platform.
    pub fn remove_game(ctx: Context<RemoveGame>) -> Result<()> {
        require!(
            ctx.accounts.platform_authority.key() == PLATFORM_AUTHORITY,
            GameRegistryError::Unauthorized
        );
        msg!("Game removed: authority={}", ctx.accounts.game.authority);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct RegisterGame<'info> {
    /// Platform authority; must match PLATFORM_AUTHORITY. Pays for account creation.
    #[account(mut)]
    pub platform_authority: Signer<'info>,

    /// The game owner (authority). Game PDA is derived from this key.
    /// CHECK: Used only as PDA seed.
    pub authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = platform_authority,
        space = 8 + Game::INIT_SPACE,
        seeds = [b"game", authority.key().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateGame<'info> {
    /// Platform authority; must match PLATFORM_AUTHORITY.
    pub platform_authority: Signer<'info>,

    /// The game owner (used to derive game PDA).
    /// CHECK: Used only as PDA seed.
    pub authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"game", authority.key().as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, Game>,
}

#[derive(Accounts)]
pub struct RemoveGame<'info> {
    /// Platform authority; must match PLATFORM_AUTHORITY. Receives closed account rent.
    #[account(mut)]
    pub platform_authority: Signer<'info>,

    /// The game owner (used to derive game PDA).
    /// CHECK: Used only as PDA seed.
    pub authority: UncheckedAccount<'info>,

    #[account(
        mut,
        close = platform_authority,
        seeds = [b"game", authority.key().as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, Game>,
}

#[account]
#[derive(InitSpace)]
pub struct Game {
    /// Authority (game owner); used as PDA seed.
    pub authority: Pubkey,
    /// Display name.
    #[max_len(GAME_NAME_MAX_LEN)]
    pub name: String,
    /// Game description.
    #[max_len(DESCRIPTION_MAX_LEN)]
    pub description: String,
    /// Cover/image URI.
    #[max_len(IMAGE_URI_MAX_LEN)]
    pub image_uri: String,
    /// Generic URI / website for the game.
    #[max_len(URI_MAX_LEN)]
    pub uri: String,
    /// Category (e.g. Action, RPG).
    #[max_len(CATEGORY_MAX_LEN)]
    pub category: String,
    /// Fee recipient for marketplace / royalties (defaults to authority).
    pub fee_recipient: Pubkey,
    /// Fee in basis points (10000 = 100%).
    pub fee_percent_bps: u16,
    /// PDA bump.
    pub bump: u8,
}

#[error_code]
pub enum GameRegistryError {
    #[msg("Only the platform authority can perform this action")]
    Unauthorized,
    #[msg("Fee percent exceeds maximum (10000 bps)")]
    FeePercentTooHigh,
    #[msg("Game name exceeds max length")]
    NameTooLong,
    #[msg("Description exceeds max length")]
    DescriptionTooLong,
    #[msg("Image URI exceeds max length")]
    ImageUriTooLong,
    #[msg("URI exceeds max length")]
    UriTooLong,
    #[msg("Category exceeds max length")]
    CategoryTooLong,
}
