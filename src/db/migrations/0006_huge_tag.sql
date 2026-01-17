CREATE TABLE "order_process_machine" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_process_id" integer NOT NULL,
	"machine_id" integer NOT NULL,
	"assigned_quantity" integer NOT NULL,
	"completed_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_processes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"process_id" integer NOT NULL,
	"available_quantity" integer NOT NULL,
	"completed_quantity" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_code" varchar(50) NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp NOT NULL,
	CONSTRAINT "orders_order_code_unique" UNIQUE("order_code")
);
--> statement-breakpoint
ALTER TABLE "order_process_machine" ADD CONSTRAINT "order_process_machine_order_process_id_order_processes_id_fk" FOREIGN KEY ("order_process_id") REFERENCES "public"."order_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_process_machine" ADD CONSTRAINT "order_process_machine_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_processes" ADD CONSTRAINT "order_processes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_processes" ADD CONSTRAINT "order_processes_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;