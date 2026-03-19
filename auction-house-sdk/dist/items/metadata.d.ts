export interface ItemAttribute {
    attack: number;
    defense: number;
    speed: number;
}
export interface ItemMetada {
    id: string;
    name: string;
    attributes: ItemAttribute | any;
}
export interface SignedItemMetadata extends ItemMetada {
    signature: string;
}
