export interface UserMapProfile {
  user_id: string;
  full_name: string;
  avatar: string;
  avatar_glb_url?: string | null;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  address_line: string | null;
}

export interface UserMapLocation {
  latitude: number;
  longitude: number;
  label: string;
}
