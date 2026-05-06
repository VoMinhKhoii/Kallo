CREATE TABLE "analysis_in_flight_limits" (
	"key_kind" text NOT NULL,
	"key_hash" text NOT NULL,
	"route" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_in_flight_limits_key_uniq" UNIQUE("key_kind","key_hash","route"),
	CONSTRAINT "analysis_in_flight_limits_key_kind_check" CHECK ("analysis_in_flight_limits"."key_kind" IN ('user')),
	CONSTRAINT "analysis_in_flight_limits_count_check" CHECK ("analysis_in_flight_limits"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analysis_rate_limit_windows" (
	"key_kind" text NOT NULL,
	"key_hash" text NOT NULL,
	"route" text NOT NULL,
	"window_kind" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_rate_limit_windows_key_uniq" UNIQUE("key_kind","key_hash","route","window_kind","window_start"),
	CONSTRAINT "analysis_rate_limit_windows_key_kind_check" CHECK ("analysis_rate_limit_windows"."key_kind" IN ('user', 'ip')),
	CONSTRAINT "analysis_rate_limit_windows_window_kind_check" CHECK ("analysis_rate_limit_windows"."window_kind" IN ('minute', 'hour', 'day')),
	CONSTRAINT "analysis_rate_limit_windows_count_check" CHECK ("analysis_rate_limit_windows"."count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "analysis_in_flight_limits_updated_idx" ON "analysis_in_flight_limits" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "analysis_rate_limit_windows_updated_idx" ON "analysis_rate_limit_windows" USING btree ("updated_at");