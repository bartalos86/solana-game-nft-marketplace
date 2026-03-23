# GameFactory & GameItemNFT
## 1. run


    ✔ deploys GameFactory and reports deployment gas
  [Gas] createGame: 156928 gas
    ✔ creates a game and reports createGame gas (13401ms)
  [Gas] createGame: 29723 gas
  [Gas] createGame: 156676 gas
    ✔ creates multiple games from one factory (21759ms)

  [Gas] createGame: 29759 gas
  [Gas] mintWithSignature (first): 183791 gas
    ✔ mints one item with signature and reports gas (26234ms)
  [Gas] createGame: 29759 gas
  [Gas] mintWithSignature #0: 166691 gas
  [Gas] mintWithSignature #1: 166703 gas
  [Gas] mintWithSignature #2: 166703 gas
    ✔ mints multiple items and reports gas per mint (47641ms)
  [Gas] createGame: 29759 gas
  [Gas] mintWithSignature: 166715 gas

## 2. run

# Marketplace

## 1 run
  [Gas] createGame (setup): 29843 gas
  [Gas] mintWithSignature (setup): 166691 gas
  [Gas] setApprovalForAll (listing): 46696 gas
  [Gas] listNFT: 203896 gas
    ✔ lists an NFT and reports listNFT gas (39526ms)
  [Gas] createGame (setup): 29843 gas
  [Gas] mintWithSignature (setup): 166715 gas
  [Gas] setApprovalForAll (listing): 26796 gas
  [Gas] listNFT: 206708 gas
  [Gas] buyNFT: 103241 gas
    1) buys a listed NFT and reports buyNFT gas (60556ms)
  [Gas] createGame (setup): 29843 gas
  [Gas] mintWithSignature (setup): 166715 gas
  [Gas] setApprovalForAll (listing): 26796 gas
  [Gas] listNFT: 206708 gas
  [Gas] cancelListing: 77103 gas
