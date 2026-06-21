export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          job_id: string | null
          project_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string | null
          project_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string | null
          project_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      job_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      job_items: {
        Row: {
          created_at: string
          id: string
          job_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          product_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          arrival_time: string | null
          category_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          departure_time: string | null
          description: string | null
          draft_quantities: Json | null
          end_time: string | null
          id: string
          project_id: string | null
          scheduled_date: string | null
          sent_to_invoicing: boolean
          sent_to_invoicing_at: string | null
          site_contact_address: string | null
          site_contact_name: string | null
          site_contact_phone: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["job_status"]
          technician_id: string | null
          technician_notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          arrival_time?: string | null
          category_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          departure_time?: string | null
          description?: string | null
          draft_quantities?: Json | null
          end_time?: string | null
          id?: string
          project_id?: string | null
          scheduled_date?: string | null
          sent_to_invoicing?: boolean
          sent_to_invoicing_at?: string | null
          site_contact_address?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          technician_id?: string | null
          technician_notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          arrival_time?: string | null
          category_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          departure_time?: string | null
          description?: string | null
          draft_quantities?: Json | null
          end_time?: string | null
          id?: string
          project_id?: string | null
          scheduled_date?: string | null
          sent_to_invoicing?: boolean
          sent_to_invoicing_at?: string | null
          site_contact_address?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          technician_id?: string | null
          technician_notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          color: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_visit_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          unit_price: number
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          unit_price?: number
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_visit_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_visit_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "project_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      project_visits: {
        Row: {
          arrival_time: string | null
          created_at: string
          departure_time: string | null
          id: string
          notes: string | null
          project_id: string
          technician_id: string
          updated_at: string
          visit_date: string
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string
          departure_time?: string | null
          id?: string
          notes?: string | null
          project_id: string
          technician_id: string
          updated_at?: string
          visit_date?: string
        }
        Update: {
          arrival_time?: string | null
          created_at?: string
          departure_time?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          technician_id?: string
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_visits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          technician_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          technician_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          technician_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "technician"
      job_status: "open" | "in_progress" | "completed"
      project_status: "open" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "technician"],
      job_status: ["open", "in_progress", "completed"],
      project_status: ["open", "closed"],
    },
  },
} as const
