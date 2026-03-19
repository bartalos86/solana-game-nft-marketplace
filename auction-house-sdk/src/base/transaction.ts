import { Transaction, Umi } from "@metaplex-foundation/umi";
import { base64 } from "@metaplex-foundation/umi/serializers";


export function serializeTransaction(umi: Umi, transaction: Transaction) {
  const serializedTx =  umi.transactions.serialize(transaction);
  const serializedTransactionAsString = base64.deserialize(serializedTx)[0];

  return serializedTransactionAsString;
}

export function deserializeTransaction(umi, encodedTransaction: string){
  const deserializedTxAsU8 = base64.serialize(encodedTransaction);
  const deserializedTx = umi.transactions.deserialize(deserializedTxAsU8)
  return deserializedTx
}