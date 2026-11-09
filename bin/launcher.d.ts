/** The launcher's pure module, which runs on Node as plain JavaScript. */
export declare const RELEASE_BASE: string
export declare const SUPPORTED: string[]
export declare function assetName(platform: string, arch: string): string
export declare function checksumFor(checksums: string, name: string): string
export declare function sha256(bytes: Uint8Array): string
export declare function verifyChecksum(checksums: string, name: string, bytes: Uint8Array): string
export declare function releaseUrl(version: string, name: string, base?: string): string
