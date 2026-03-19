/// <reference types="node" />
/// <reference types="node" />
export interface ipfsCreds {
    projectId: string;
    secretKey: string;
}
export declare function ipfsUpload(ipfsCredentials: ipfsCreds, image: string, animation: string, manifestBuffer: Buffer): Promise<string[]>;
