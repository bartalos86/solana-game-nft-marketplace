/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `./game_registry.json`.
 */
export type GameRegistry = {
  address: '4jDnCxk12L9DNAiuMp3ddJYqFgsfpEW7aY4S7m8HFDwx',
  metadata: {
    name: 'gameRegistry',
    version: '0.1.0',
    spec: '0.1.0',
    description: 'On-chain game registry for NFT marketplace'
  },
  instructions: [
    {
      name: 'registerGame',
      docs: [
        'Register a game. Only the platform authority can register. One game account per authority.',
        'Seeds: ["game", authority]'
      ],
      discriminator: [122, 44, 95, 58, 89, 33, 40, 59],
      accounts: [
        { name: 'platformAuthority', writable: true, signer: true },
        { name: 'authority' },
        { name: 'game', writable: true, pda: { seeds: [{ kind: 'const', value: [103, 97, 109, 101] }, { kind: 'account', path: 'authority' }] } },
        { name: 'systemProgram', address: '11111111111111111111111111111111' }
      ],
      args: [
        { name: 'name', type: 'string' },
        { name: 'description', type: { option: 'string' } },
        { name: 'imageUri', type: { option: 'string' } },
        { name: 'uri', type: { option: 'string' } },
        { name: 'category', type: { option: 'string' } },
        { name: 'feeRecipient', type: { option: 'pubkey' } },
        { name: 'feePercentBps', type: 'u16' }
      ]
    },
    {
      name: 'removeGame',
      docs: ['Remove (close) a game account. Only the platform authority can remove. Rent goes to platform.'],
      discriminator: [208, 12, 103, 49, 155, 37, 215, 223],
      accounts: [
        { name: 'platformAuthority', writable: true, signer: true },
        { name: 'authority' },
        { name: 'game', writable: true, pda: { seeds: [{ kind: 'const', value: [103, 97, 109, 101] }, { kind: 'account', path: 'authority' }] } }
      ],
      args: []
    },
    {
      name: 'updateGame',
      docs: ['Update game metadata. Only the platform authority can update.'],
      discriminator: [159, 61, 132, 131, 3, 234, 209, 220],
      accounts: [
        { name: 'platformAuthority', signer: true },
        { name: 'authority' },
        { name: 'game', writable: true, pda: { seeds: [{ kind: 'const', value: [103, 97, 109, 101] }, { kind: 'account', path: 'authority' }] } }
      ],
      args: [
        { name: 'name', type: { option: 'string' } },
        { name: 'description', type: { option: { option: 'string' } } },
        { name: 'imageUri', type: { option: { option: 'string' } } },
        { name: 'uri', type: { option: { option: 'string' } } },
        { name: 'category', type: { option: { option: 'string' } } },
        { name: 'feeRecipient', type: { option: 'pubkey' } },
        { name: 'feePercentBps', type: { option: 'u16' } }
      ]
    }
  ],
  accounts: [{ name: 'game', discriminator: [27, 90, 166, 125, 74, 100, 121, 18] }],
  errors: [
    { code: 6000, name: 'unauthorized', msg: 'Only the platform authority can perform this action' },
    { code: 6001, name: 'feePercentTooHigh', msg: 'Fee percent exceeds maximum (10000 bps)' },
    { code: 6002, name: 'nameTooLong', msg: 'Game name exceeds max length' },
    { code: 6003, name: 'descriptionTooLong', msg: 'Description exceeds max length' },
    { code: 6004, name: 'imageUriTooLong', msg: 'Image URI exceeds max length' },
    { code: 6005, name: 'uriTooLong', msg: 'URI exceeds max length' },
    { code: 6006, name: 'categoryTooLong', msg: 'Category exceeds max length' }
  ],
  types: [
    {
      name: 'game',
      type: {
        kind: 'struct',
        fields: [
          { name: 'authority', docs: ['Authority (game owner); used as PDA seed.'], type: 'pubkey' },
          { name: 'name', docs: ['Display name.'], type: 'string' },
          { name: 'description', docs: ['Game description.'], type: 'string' },
          { name: 'imageUri', docs: ['Cover/image URI.'], type: 'string' },
          { name: 'uri', docs: ['Generic URI / website for the game.'], type: 'string' },
          { name: 'category', docs: ['Category (e.g. Action, RPG).'], type: 'string' },
          { name: 'feeRecipient', docs: ['Fee recipient for marketplace / royalties (defaults to authority).'], type: 'pubkey' },
          { name: 'feePercentBps', docs: ['Fee in basis points (10000 = 100%).'], type: 'u16' },
          { name: 'bump', docs: ['PDA bump.'], type: 'u8' }
        ]
      }
    }
  ]
}
