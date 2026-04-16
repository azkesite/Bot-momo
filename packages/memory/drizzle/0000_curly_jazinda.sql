CREATE TYPE "public"."keyword_match_type" AS ENUM('exact', 'fuzzy', 'regex');--> statement-breakpoint
CREATE TYPE "public"."memory_scope" AS ENUM('short_term', 'mid_term', 'long_term');--> statement-breakpoint
CREATE TYPE "public"."reply_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."summary_scope" AS ENUM('group', 'user');--> statement-breakpoint
CREATE TABLE "conversation_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" "summary_scope" NOT NULL,
	"group_id" text,
	"user_id" text,
	"summary" text NOT NULL,
	"source_message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"external_group_id" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"keyword" text NOT NULL,
	"match_type" "keyword_match_type" NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"response_mode" text DEFAULT 'must_reply' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_facts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scope" "memory_scope" NOT NULL,
	"fact" text NOT NULL,
	"source_message_id" text,
	"confidence" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reply_to_message_id" text,
	"content" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"mentioned_bot" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reply_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"trace_id" text NOT NULL,
	"decision_action" text NOT NULL,
	"decision_reason" text NOT NULL,
	"content_preview" text NOT NULL,
	"status" "reply_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"nickname_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"traits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"relationship_summary" text DEFAULT '' NOT NULL,
	"last_interaction_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_memories_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"external_user_id" text NOT NULL,
	"nickname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_facts" ADD CONSTRAINT "memory_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_facts" ADD CONSTRAINT "memory_facts_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_logs" ADD CONSTRAINT "reply_logs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_summaries_scope_group_idx" ON "conversation_summaries" USING btree ("scope","group_id");--> statement-breakpoint
CREATE INDEX "conversation_summaries_scope_user_idx" ON "conversation_summaries" USING btree ("scope","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_platform_external_group_idx" ON "groups" USING btree ("platform","external_group_id");--> statement-breakpoint
CREATE INDEX "keyword_rules_enabled_priority_idx" ON "keyword_rules" USING btree ("enabled","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_rules_keyword_match_type_idx" ON "keyword_rules" USING btree ("keyword","match_type");--> statement-breakpoint
CREATE INDEX "memory_facts_user_scope_idx" ON "memory_facts" USING btree ("user_id","scope");--> statement-breakpoint
CREATE INDEX "memory_facts_source_message_idx" ON "memory_facts" USING btree ("source_message_id");--> statement-breakpoint
CREATE INDEX "messages_group_sent_at_idx" ON "messages" USING btree ("group_id","sent_at");--> statement-breakpoint
CREATE INDEX "messages_user_sent_at_idx" ON "messages" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "messages_reply_to_idx" ON "messages" USING btree ("reply_to_message_id");--> statement-breakpoint
CREATE INDEX "reply_logs_message_idx" ON "reply_logs" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "reply_logs_trace_idx" ON "reply_logs" USING btree ("trace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_platform_external_user_idx" ON "users" USING btree ("platform","external_user_id");