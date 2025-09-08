export interface DatabaseUser {
    discord_user_id?: string;
    username: string;
    avatar: string;
    rights_update?: boolean;
    rights_testing_ground?: boolean;
}