# Cloudflare Supabase Reservations MCP Server + GitHub OAuth

This [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server lets an LLM **manage reservations stored in Supabase**. It deploys as a remote MCP server on Cloudflare Workers with GitHub OAuth so you can control who can create, update, or delete entries in your reservations table.

## Key Features

- **🔗 Supabase Integration**: Uses the Supabase REST API to read and write reservations without managing direct TCP connections.
- **🛠️ Purpose-Built Tools**: Exposes focused MCP tools for creating, updating, and deleting reservations through Supabase.
- **🔐 GitHub OAuth Protection**: OAuth login keeps the server private, with a no-auth variant for trusted local testing.
- **📈 Monitoring Ready**: Optional Sentry integration wraps every tool for production observability.
- **☁️ Cloud Native**: Runs entirely on [Cloudflare Workers](https://developers.cloudflare.com/workers/) for global scale.

## Modular Architecture

This MCP server uses a clean, modular architecture that makes it easy to extend and maintain:

- **`src/tools/`** - Individual tool implementations in separate files
- **`registerAllTools()`** - Centralized tool registration system 
- **Extensible Design** - Add new tools by creating files in `tools/` and registering them

This architecture allows you to easily add new database operations, external API integrations, or any other MCP tools while keeping the codebase organized and maintainable.

## Transport Protocols

This MCP server supports both modern and legacy transport protocols:

- **`/mcp` - Streamable HTTP** (recommended): Uses a single endpoint with bidirectional communication, automatic connection upgrades, and better resilience for network interruptions
- **`/sse` - Server-Sent Events** (legacy): Uses separate endpoints for requests/responses, maintained for backward compatibility

For new implementations, use the `/mcp` endpoint as it provides better performance and reliability.

## How It Works

The MCP server exposes three reservation-focused tools backed by Supabase:

1. **`createReservation`** – Insert a new reservation row. Requires the guest's mobile number, name, number of people, date, and time (email and notes are optional).
2. **`updateReservation`** – Locate an existing reservation by the current guest name and mobile number, then update details such as party size, time, notes, or even contact info.
3. **`deleteReservation`** – Remove a reservation by providing the guest name and mobile number.

**Authentication Flow**: Users authenticate via GitHub OAuth before they can reach the server. Once connected, all three reservation tools are available. Use the no-auth entry point for trusted local workflows that do not require OAuth.

## Simple Examples First

### No-Auth Reservations Server (Local/Trusted Environments)

If you want to experiment with the reservations tools before configuring OAuth, use the no-auth variant in `src/index-noauth.ts`. It exposes `createReservation`, `updateReservation`, and `deleteReservation` without authentication—ideal for local development or trusted environments.

Run it with:

```bash
wrangler dev --config wrangler-noauth.jsonc
```

Then connect via MCP Inspector at `http://localhost:8793/mcp`.

⚠️ **Security Warning**: The no-auth server allows anyone who can reach it to perform full CRUD operations on your Supabase data. Only use it on localhost or protected networks.

### Minimal Math Server

Want to see a basic MCP server that doesn't talk to a database? Check out `src/simple-math.ts` - a minimal MCP server with a single `calculate` tool that performs basic math operations (add, subtract, multiply, divide). This example demonstrates the core MCP components: server setup, tool definition with Zod schemas, and dual transport support (`/mcp` and `/sse` endpoints). You can run it locally with `wrangler dev --config wrangler-simple.jsonc` and test at `http://localhost:8789/mcp`.

## Prerequisites

- Node.js installed on your machine
- A Cloudflare account (free tier works)
- A GitHub account for OAuth setup
- A Supabase project (or any PostgreSQL instance exposed through Supabase REST)

## Getting Started

### Step 1: Install Wrangler CLI

Install Wrangler globally to manage your Cloudflare Workers:

```bash
npm install -g wrangler
```

### Step 2: Authenticate with Cloudflare

Log in to your Cloudflare account:

```bash
wrangler login
```

This will open a browser window where you can authenticate with your Cloudflare account.

### Step 3: Clone and Setup

Clone the repo directly & install dependencies: `npm install`.

## Environment Variables Setup

Before running the MCP server, you need to configure several environment variables for authentication and database access.

### Create Environment Variables File

1. **Create your `.dev.vars` file** from the example:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. **Configure all required environment variables** in `.dev.vars`:
   ```
   # GitHub OAuth (for authentication)
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   COOKIE_ENCRYPTION_KEY=your_random_encryption_key

  # Supabase connection
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Optional: Sentry monitoring
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   NODE_ENV=development
   ```

### Getting GitHub OAuth Credentials

1. **Create a GitHub OAuth App** for local development:
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click "New OAuth App"
   - **Application name**: `MCP Server (Local Development)`
   - **Homepage URL**: `http://localhost:8792`
   - **Authorization callback URL**: `http://localhost:8792/callback`
   - Click "Register application"

2. **Copy your credentials**:
   - Copy the **Client ID** and paste it as `GITHUB_CLIENT_ID` in `.dev.vars`
   - Click "Generate a new client secret", copy it, and paste as `GITHUB_CLIENT_SECRET` in `.dev.vars`

### Generate Encryption Key

Generate a secure random encryption key for cookie encryption:
```bash
openssl rand -hex 32
```
Copy the output and paste it as `COOKIE_ENCRYPTION_KEY` in `.dev.vars`.

## Database Setup

1. **Create a Supabase project** (the free tier is enough for development).
2. **Create a `reservations` table** with the required columns. You can run this SQL in the Supabase SQL editor:
   ```sql
   create table if not exists reservations (
     id bigint generated by default as identity primary key,
     mobile text not null,
     name text not null,
     nb_people integer not null,
    email text,
     date date not null,
     time time not null,
     notes text,
     inserted_at timestamp with time zone default timezone('utc', now())
   );
   ```
   Feel free to adjust defaults or add indexes as needed.
3. **Grab your Supabase project URL and service role key** from Project Settings → API and set them as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Because the service role key bypasses Row Level Security, make sure you store it only in server-side secrets (Wrangler `.dev.vars`, `wrangler secret`, etc.).

## Local Development & Testing

**Run the server locally**:
   ```bash
   wrangler dev
   ```
   This makes the server available at `http://localhost:8792`

### Testing with MCP Inspector

Use the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) to test your server:

1. **Install and run Inspector**:
   ```bash
   npx @modelcontextprotocol/inspector@latest
   ```

2. **Connect to your local server**:
   - **Preferred**: Enter URL: `http://localhost:8792/mcp` (streamable HTTP transport - newer, more robust)
   - **Alternative**: Enter URL: `http://localhost:8792/sse` (SSE transport - legacy support)
   - Click "Connect"
   - Follow the OAuth prompts to authenticate with GitHub
   - Once connected, you'll see the available tools

3. **Test the tools**:
   - Use `createReservation` to add a new booking with the guest's mobile, name, party size, date, and time.
   - Use `updateReservation` to adjust an existing booking by referencing the current guest name and mobile number.
   - Use `deleteReservation` to remove a reservation that matches a specific guest name and mobile number.

## Production Deployment

#### Set up a KV namespace
- Create the KV namespace: 
`wrangler kv namespace create "OAUTH_KV"`
- Update the `wrangler.jsonc` file with the KV ID (replace <Add-KV-ID>)

#### Deploy
Deploy the MCP server to make it available on your workers.dev domain

```bash
wrangler deploy
```

### Create environment variables in production
Create a new [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app): 
- For the Homepage URL, specify `https://mcp-github-oauth.<your-subdomain>.workers.dev`
- For the Authorization callback URL, specify `https://mcp-github-oauth.<your-subdomain>.workers.dev/callback`
- Note your Client ID and generate a Client secret. 
- Set all required secrets via Wrangler:
```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY  # use: openssl rand -hex 32
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SENTRY_DSN  # optional (more on Sentry setup below)
```

#### Test

Test the remote server using [Inspector](https://modelcontextprotocol.io/docs/tools/inspector): 

```
npx @modelcontextprotocol/inspector@latest
```
Enter `https://mcp-github-oauth.<your-subdomain>.workers.dev/mcp` (preferred) or `https://mcp-github-oauth.<your-subdomain>.workers.dev/sse` (legacy) and hit connect. Once you go through the authentication flow, you'll see the Tools working: 

<img width="640" alt="image" src="https://github.com/user-attachments/assets/7973f392-0a9d-4712-b679-6dd23f824287" />

You now have a remote MCP server deployed! 

## Reservations Tools

### Available Tools

- **`createReservation`** – Inserts a reservation row with the guest's mobile number, name, number of people, date, and time. Email and notes can be supplied when available.
- **`updateReservation`** – Matches an existing reservation by the current guest name and mobile number, then updates any combination of fields (`nb_people`, `date`, `time`, `notes`, or even new contact details via `new_mobile`/`new_name`).
- **`deleteReservation`** – Removes a reservation that matches a specific guest name and mobile number.

### Access Control

All three tools are available once a client completes the GitHub OAuth handshake. For local experiments or trusted automation you can run the no-auth worker (`wrangler dev --config wrangler-noauth.jsonc`), which exposes the same tools without requiring OAuth.

### Typical Workflow

1. **➕ Create**: `createReservation` to register new bookings as they arrive.
2. **✏️ Adjust**: `updateReservation` to change party size, schedule, or contact info for an existing guest (supply the current name and mobile so the record can be located).
3. **🗑️ Cleanup**: `deleteReservation` when a guest cancels or a duplicate entry slips in.

### Security Notes

- The service role key grants unrestricted access—treat it like a password and only store it in secret storage.
- Supabase row-level security rules are bypassed by the service role key; if you enable RLS, ensure policies allow the service role to perform the required actions.
- Tool responses always include the JSON payloads returned by Supabase so you can audit changes.

### Access the remote MCP server from Claude Desktop

Open Claude Desktop and navigate to Settings -> Developer -> Edit Config. This opens the configuration file that controls which MCP servers Claude can access.

Replace the content with the following configuration. Once you restart Claude Desktop, a browser window will open showing your OAuth login page. Complete the authentication flow to grant Claude access to your MCP server. After you grant access, the tools will become available for you to use. 

```
{
  "mcpServers": {
    "math": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp-github-oauth.<your-subdomain>.workers.dev/mcp"
      ]
    }
  }
}
```

Once the Tools (under 🔨) show up in the interface, you can ask Claude to manage reservations. Example prompts:

- **"Book a table for Sam tomorrow at 19:30 for four people."** → Uses `createReservation`.
- **"Update the reservation for Sam (mobile +15551234567) to 20:00 and add a note about allergies."** → Uses `updateReservation` with the guest name and mobile number to locate the record.
- **"Cancel the reservation for Sam with mobile +15551234567."** → Uses `deleteReservation`.

### Using Claude and other MCP Clients

When using Claude to connect to your remote MCP server, you may see some error messages. This is because Claude Desktop doesn't yet support remote MCP servers, so it sometimes gets confused. To verify whether the MCP server is connected, hover over the 🔨 icon in the bottom right corner of Claude's interface. You should see your tools available there.

#### Using Cursor and other MCP Clients

To connect Cursor with your MCP server, choose `Type`: "Command" and in the `Command` field, combine the command and args fields into one (e.g. `npx mcp-remote https://<your-worker-name>.<your-subdomain>.workers.dev/sse`).

Note that while Cursor supports HTTP+SSE servers, it doesn't support authentication, so you still need to use `mcp-remote` (and to use a STDIO server, not an HTTP one).

You can connect your MCP server to other MCP clients like Windsurf by opening the client's configuration file, adding the same JSON that was used for the Claude setup, and restarting the MCP client.

## Sentry Integration (Optional)

This project includes optional Sentry integration for comprehensive error tracking, performance monitoring, and distributed tracing. There are two versions available:

- `src/index.ts` - Standard version without Sentry
- `src/index_sentry.ts` - Version with full Sentry integration

### Setting Up Sentry

1. **Create a Sentry Account**: Sign up at [sentry.io](https://sentry.io) if you don't have an account.

2. **Create a New Project**: Create a new project in Sentry and select "Cloudflare Workers" as the platform (search in the top right).

3. **Get Your DSN**: Copy the DSN from your Sentry project settings.

### Using Sentry in Production

To deploy with Sentry monitoring:

1. **Set the Sentry DSN secret**:
   ```bash
   wrangler secret put SENTRY_DSN
   ```
   Enter your Sentry DSN when prompted.

2. **Update your wrangler.toml** to use the Sentry-enabled version:
   ```toml
   main = "src/index_sentry.ts"
   ```

3. **Deploy with Sentry**:
   ```bash
   wrangler deploy
   ```

### Using Sentry in Development

1. **Add Sentry DSN to your `.dev.vars` file**:
   ```
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   NODE_ENV=development
   ```

2. **Run with Sentry enabled**:
   ```bash
   wrangler dev
   ```

### Sentry Features Included

- **Error Tracking**: Automatic capture of all errors with context
- **Performance Monitoring**: Full request tracing with 100% sample rate
- **User Context**: Automatically binds GitHub user information to events
- **Tool Tracing**: Each MCP tool call is traced with parameters
- **Custom Error Handling**: User-friendly error messages with Event IDs
- **Context Enrichment**: Automatic tagging and context for better debugging

## How does it work? 

#### OAuth Provider
The OAuth Provider library serves as a complete OAuth 2.1 server implementation for Cloudflare Workers. It handles the complexities of the OAuth flow, including token issuance, validation, and management. In this project, it plays the dual role of:

- Authenticating MCP clients that connect to your server
- Managing the connection to GitHub's OAuth services
- Securely storing tokens and authentication state in KV storage

#### Durable MCP
Durable MCP extends the base MCP functionality with Cloudflare's Durable Objects, providing:
- Persistent state management for your MCP server
- Secure storage of authentication context between requests
- Access to authenticated user information via `this.props`
- Support for conditional tool availability based on user identity

#### MCP Remote
The MCP Remote library enables your server to expose tools that can be invoked by MCP clients like the Inspector. It:
- Defines the protocol for communication between clients and your server
- Provides a structured way to define tools
- Handles serialization and deserialization of requests and responses
- Maintains the Server-Sent Events (SSE) connection between clients and your server

## Testing

This project includes comprehensive unit tests covering all major functionality:

```bash
npm test        # Run all tests
npm run test:ui # Run tests with UI
```

The test suite covers database security, tool registration, permission handling, and response formatting with proper mocking of external dependencies.
