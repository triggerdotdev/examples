export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          name: string;
          website: string | null;
          description: string | null;
          industry: string | null;
          employee_count: string | null;
          amount_raised: string | null;
          enrichment_status: string;
          enrichment_started_at: string | null;
          enrichment_completed_at: string | null;
          errors: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          name: string;
          website?: string | null;
          description?: string | null;
          industry?: string | null;
          employee_count?: string | null;
          amount_raised?: string | null;
          enrichment_status?: string;
          enrichment_started_at?: string | null;
          enrichment_completed_at?: string | null;
          errors?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          name?: string;
          website?: string | null;
          description?: string | null;
          industry?: string | null;
          employee_count?: string | null;
          amount_raised?: string | null;
          enrichment_status?: string;
          enrichment_started_at?: string | null;
          enrichment_completed_at?: string | null;
          errors?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Company = Database["public"]["Tables"]["companies"]["Row"];
