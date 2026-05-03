interface SendOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare function sendEmail(opts: SendOptions): Promise<boolean>;
export declare function sendVerificationEmail(to: string, displayName: string, token: string): Promise<boolean>;
export declare function sendPasswordResetEmail(to: string, displayName: string, token: string): Promise<boolean>;
export declare function sendMagicLinkEmail(to: string, displayName: string, token: string): Promise<boolean>;
export {};
