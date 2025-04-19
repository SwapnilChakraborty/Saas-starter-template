import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Prisma, Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Explicitly type the headers() result
  const headerPayload = await headers();

  // Get headers safely
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Rest of the code remains unchanged
  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Webhook with an ID of ${id} and type of ${eventType}`);
  console.log("Webhook body:", body);

  if (eventType === "user.created") {
    try {
      // Extract needed fields from Clerk data
      const { 
        id,
        email_addresses, 
        primary_email_address_id,
        first_name,
        last_name,
        username 
      } = evt.data;
  
      // Get primary email
      const primaryEmail = email_addresses.find(
        email => email.id === primary_email_address_id
      )?.email_address;
  
      if (!primaryEmail) {
        return new Response("No primary email found", { status: 400 });
      }
  
      // Construct name from available data
      const name = [first_name, last_name].filter(Boolean).join(" ") 
        || username 
        || "Anonymous";
  
      // Create user with all required fields
      const newUser = await prisma.user.create({
        data: {
          id,
          email: primaryEmail,
          name, // Now included
          role: Role.USER,
          isSubscribed: false
        },
      });
      
      console.log("New user created:", newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return new Response("User exists", { status: 409 });
      }
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  return new Response("Success", { status: 200 });
}