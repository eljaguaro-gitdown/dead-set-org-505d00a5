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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          setlist_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          setlist_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          setlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["collaborator_role"]
          setlist_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["collaborator_role"]
          setlist_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["collaborator_role"]
          setlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      eras: {
        Row: {
          description: string | null
          id: string
          name: string
          year_end: number
          year_start: number
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          year_end: number
          year_start: number
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          year_end?: number
          year_start?: number
        }
        Relationships: []
      }
      notable_versions: {
        Row: {
          archive_org_url: string | null
          city: string | null
          description: string | null
          era_id: string | null
          id: string
          rating: number | null
          show_date: string
          song_id: string
          venue: string | null
        }
        Insert: {
          archive_org_url?: string | null
          city?: string | null
          description?: string | null
          era_id?: string | null
          id?: string
          rating?: number | null
          show_date: string
          song_id: string
          venue?: string | null
        }
        Update: {
          archive_org_url?: string | null
          city?: string | null
          description?: string | null
          era_id?: string | null
          id?: string
          rating?: number | null
          show_date?: string
          song_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notable_versions_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "eras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notable_versions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      setlist_slots: {
        Row: {
          added_by_user_id: string | null
          id: string
          notable_version_id: string | null
          notes: string | null
          position: number
          segue_to_next: boolean | null
          set_number: number
          setlist_id: string
          song_id: string
        }
        Insert: {
          added_by_user_id?: string | null
          id?: string
          notable_version_id?: string | null
          notes?: string | null
          position: number
          segue_to_next?: boolean | null
          set_number: number
          setlist_id: string
          song_id: string
        }
        Update: {
          added_by_user_id?: string | null
          id?: string
          notable_version_id?: string | null
          notes?: string | null
          position?: number
          segue_to_next?: boolean | null
          set_number?: number
          setlist_id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlist_slots_notable_version_id_fkey"
            columns: ["notable_version_id"]
            isOneToOne: false
            referencedRelation: "notable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setlist_slots_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setlist_slots_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      setlists: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          era_id: string | null
          id: string
          is_collaborative: boolean | null
          is_public: boolean | null
          share_token: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          era_id?: string | null
          id?: string
          is_collaborative?: boolean | null
          is_public?: boolean | null
          share_token?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          era_id?: string | null
          id?: string
          is_collaborative?: boolean | null
          is_public?: boolean | null
          share_token?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlists_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "eras"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          first_played: string | null
          id: string
          is_jam_vehicle: boolean | null
          last_played: string | null
          tags: string[] | null
          times_played: number | null
          title: string
          typical_set_position:
            | Database["public"]["Enums"]["set_position"]
            | null
        }
        Insert: {
          first_played?: string | null
          id?: string
          is_jam_vehicle?: boolean | null
          last_played?: string | null
          tags?: string[] | null
          times_played?: number | null
          title: string
          typical_set_position?:
            | Database["public"]["Enums"]["set_position"]
            | null
        }
        Update: {
          first_played?: string | null
          id?: string
          is_jam_vehicle?: boolean | null
          last_played?: string | null
          tags?: string[] | null
          times_played?: number | null
          title?: string
          typical_set_position?:
            | Database["public"]["Enums"]["set_position"]
            | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_setlist_collaborator: {
        Args: { _setlist_id: string; _user_id: string }
        Returns: boolean
      }
      is_setlist_owner: {
        Args: { _setlist_id: string; _user_id: string }
        Returns: boolean
      }
      is_setlist_public: { Args: { _setlist_id: string }; Returns: boolean }
      setlist_has_share_token: {
        Args: { _setlist_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      collaborator_role: "owner" | "editor" | "viewer"
      set_position: "opener" | "early" | "mid" | "late" | "closer" | "encore"
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
      app_role: ["admin", "moderator", "user"],
      collaborator_role: ["owner", "editor", "viewer"],
      set_position: ["opener", "early", "mid", "late", "closer", "encore"],
    },
  },
} as const
