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
      ab_test_assignments: {
        Row: {
          converted: boolean
          created_at: string
          id: string
          test_name: string
          user_id: string | null
          variant: string
          visitor_id: string
        }
        Insert: {
          converted?: boolean
          created_at?: string
          id?: string
          test_name: string
          user_id?: string | null
          variant: string
          visitor_id: string
        }
        Update: {
          converted?: boolean
          created_at?: string
          id?: string
          test_name?: string
          user_id?: string | null
          variant?: string
          visitor_id?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          body: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      changelog_entries: {
        Row: {
          created_at: string
          credit: string | null
          detail: string
          edition_title: string
          encore_note: string | null
          id: string
          next_week_teaser: string | null
          published: boolean
          set_number: number
          tag: Database["public"]["Enums"]["changelog_tag"]
          title: string
          week_label: string
          week_number: number
          week_stats_bugs: number
          week_stats_feedback: number
          week_stats_updates: number
        }
        Insert: {
          created_at?: string
          credit?: string | null
          detail?: string
          edition_title?: string
          encore_note?: string | null
          id?: string
          next_week_teaser?: string | null
          published?: boolean
          set_number?: number
          tag: Database["public"]["Enums"]["changelog_tag"]
          title: string
          week_label: string
          week_number: number
          week_stats_bugs?: number
          week_stats_feedback?: number
          week_stats_updates?: number
        }
        Update: {
          created_at?: string
          credit?: string | null
          detail?: string
          edition_title?: string
          encore_note?: string | null
          id?: string
          next_week_teaser?: string | null
          published?: boolean
          set_number?: number
          tag?: Database["public"]["Enums"]["changelog_tag"]
          title?: string
          week_label?: string
          week_number?: number
          week_stats_bugs?: number
          week_stats_feedback?: number
          week_stats_updates?: number
        }
        Relationships: []
      }
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
      comment_notifications: {
        Row: {
          comment_id: string
          commenter_name: string | null
          commenter_user_id: string
          created_at: string
          id: string
          preview: string | null
          read: boolean
          recipient_user_id: string
          setlist_id: string
          setlist_title: string | null
        }
        Insert: {
          comment_id: string
          commenter_name?: string | null
          commenter_user_id: string
          created_at?: string
          id?: string
          preview?: string | null
          read?: boolean
          recipient_user_id: string
          setlist_id: string
          setlist_title?: string | null
        }
        Update: {
          comment_id?: string
          commenter_name?: string | null
          commenter_user_id?: string
          created_at?: string
          id?: string
          preview?: string | null
          read?: boolean
          recipient_user_id?: string
          setlist_id?: string
          setlist_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comment_notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "setlist_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_notifications_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_group: boolean
          last_message_at: string
          name: string | null
          user_one: string
          user_two: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          user_one: string
          user_two: string
        }
        Update: {
          created_at?: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          user_one?: string
          user_two?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_setlists: {
        Row: {
          anon_session_id: string
          cosmic_charlie_input: Json | null
          created_at: string
          era_filter: string | null
          expires_at: string
          id: string
          songs: Json
          title: string
          updated_at: string
        }
        Insert: {
          anon_session_id: string
          cosmic_charlie_input?: Json | null
          created_at?: string
          era_filter?: string | null
          expires_at?: string
          id?: string
          songs?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          anon_session_id?: string
          cosmic_charlie_input?: Json | null
          created_at?: string
          era_filter?: string | null
          expires_at?: string
          id?: string
          songs?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_sends: {
        Row: {
          error_message: string | null
          id: string
          sent_at: string
          status: string
          template: string
          user_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          sent_at?: string
          status: string
          template: string
          user_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          template?: string
          user_id?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
      favorite_song_setlists: {
        Row: {
          created_at: string
          id: string
          setlist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          setlist_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          setlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_song_setlists_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: true
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_songs: {
        Row: {
          created_at: string
          id: string
          notable_version_id: string | null
          song_id: string
          user_id: string
          version_archive_org_url: string | null
          version_rating: number | null
          version_show_date: string | null
          version_venue: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notable_version_id?: string | null
          song_id: string
          user_id: string
          version_archive_org_url?: string | null
          version_rating?: number | null
          version_show_date?: string | null
          version_venue?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notable_version_id?: string | null
          song_id?: string
          user_id?: string
          version_archive_org_url?: string | null
          version_rating?: number | null
          version_show_date?: string | null
          version_venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_songs_notable_version_id_fkey"
            columns: ["notable_version_id"]
            isOneToOne: false
            referencedRelation: "notable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          setlist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          setlist_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          setlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      insider_bugs: {
        Row: {
          created_at: string
          description: string
          device: string | null
          id: string
          location: string | null
          repeats: boolean | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          device?: string | null
          id?: string
          location?: string | null
          repeats?: boolean | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          device?: string | null
          id?: string
          location?: string | null
          repeats?: boolean | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      insider_shares: {
        Row: {
          created_at: string
          favorite_show: string | null
          favorite_songs: string | null
          handle: string | null
          id: string
          personal_take: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          favorite_show?: string | null
          favorite_songs?: string | null
          handle?: string | null
          id?: string
          personal_take?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          favorite_show?: string | null
          favorite_songs?: string | null
          handle?: string | null
          id?: string
          personal_take?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      insider_wishlist: {
        Row: {
          bigger_picture: string | null
          created_at: string
          id: string
          top_request: string | null
          user_id: string | null
          what_works: string | null
        }
        Insert: {
          bigger_picture?: string | null
          created_at?: string
          id?: string
          top_request?: string | null
          user_id?: string | null
          what_works?: string | null
        }
        Update: {
          bigger_picture?: string | null
          created_at?: string
          id?: string
          top_request?: string | null
          user_id?: string | null
          what_works?: string | null
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
      page_visits: {
        Row: {
          created_at: string
          id: string
          landing_source: string | null
          page_path: string
          referrer: string | null
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          landing_source?: string | null
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          landing_source?: string | null
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      play_events: {
        Row: {
          archive_url: string | null
          completed: boolean
          created_at: string
          duration_played_ms: number
          ended_at: string | null
          ended_reason: string
          id: string
          setlist_id: string | null
          show_date: string | null
          slot_id: string | null
          song_id: string | null
          song_title: string | null
          started_at: string
          track_duration_ms: number | null
          user_id: string | null
          venue: string | null
          visitor_id: string | null
        }
        Insert: {
          archive_url?: string | null
          completed?: boolean
          created_at?: string
          duration_played_ms?: number
          ended_at?: string | null
          ended_reason?: string
          id?: string
          setlist_id?: string | null
          show_date?: string | null
          slot_id?: string | null
          song_id?: string | null
          song_title?: string | null
          started_at?: string
          track_duration_ms?: number | null
          user_id?: string | null
          venue?: string | null
          visitor_id?: string | null
        }
        Update: {
          archive_url?: string | null
          completed?: boolean
          created_at?: string
          duration_played_ms?: number
          ended_at?: string | null
          ended_reason?: string
          id?: string
          setlist_id?: string | null
          show_date?: string | null
          slot_id?: string | null
          song_id?: string | null
          song_title?: string | null
          started_at?: string
          track_duration_ms?: number | null
          user_id?: string | null
          venue?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          home_state: string | null
          id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_state?: string | null
          id?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_state?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      setlist_comments: {
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
            foreignKeyName: "setlist_comments_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      setlist_slots: {
        Row: {
          added_by_user_id: string | null
          favorite_song_id: string | null
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
          favorite_song_id?: string | null
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
          favorite_song_id?: string | null
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
      setlist_upvotes: {
        Row: {
          created_at: string
          id: string
          setlist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          setlist_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          setlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlist_upvotes_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
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
          play_count: number
          share_token: string | null
          title: string
          updated_at: string
          upvote_count: number
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          era_id?: string | null
          id?: string
          is_collaborative?: boolean | null
          is_public?: boolean | null
          play_count?: number
          share_token?: string | null
          title?: string
          updated_at?: string
          upvote_count?: number
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          era_id?: string | null
          id?: string
          is_collaborative?: boolean | null
          is_public?: boolean | null
          play_count?: number
          share_token?: string | null
          title?: string
          updated_at?: string
          upvote_count?: number
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
      share_events: {
        Row: {
          channel: string
          created_at: string
          id: string
          metadata: Json | null
          setlist_id: string | null
          share_type: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          metadata?: Json | null
          setlist_id?: string | null
          share_type: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          setlist_id?: string | null
          share_type?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_events_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      visitor_attribution: {
        Row: {
          first_landing_path: string | null
          first_referrer: string | null
          first_seen_at: string
          first_source: string | null
          signed_up_at: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          first_landing_path?: string | null
          first_referrer?: string | null
          first_seen_at?: string
          first_source?: string | null
          signed_up_at?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          first_landing_path?: string | null
          first_referrer?: string | null
          first_seen_at?: string
          first_source?: string | null
          signed_up_at?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_drafts: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_favorite_song_setlist: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_play_count: {
        Args: { _setlist_id: string }
        Returns: undefined
      }
      increment_upvote_count: {
        Args: { _setlist_id: string }
        Returns: undefined
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
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
      link_visitor_to_user: {
        Args: { _visitor_id: string }
        Returns: undefined
      }
      mark_ab_conversion: {
        Args: { p_user_id?: string; p_visitor_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      setlist_has_share_token: {
        Args: { _setlist_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      changelog_tag: "fix" | "new" | "improved" | "beta"
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
      changelog_tag: ["fix", "new", "improved", "beta"],
      collaborator_role: ["owner", "editor", "viewer"],
      set_position: ["opener", "early", "mid", "late", "closer", "encore"],
    },
  },
} as const
