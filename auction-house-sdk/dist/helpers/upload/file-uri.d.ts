type Manifest = {
    name: string;
    image: string;
    animation_url: string;
    properties: {
        files: Array<{
            type: string;
            uri: string;
        }>;
    };
};
export declare function setImageUrlManifest(manifestString: string, imageLink: string, animationLink: string): Promise<Manifest>;
export {};
