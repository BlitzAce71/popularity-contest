# Deployment Guide

This guide will walk you through deploying the Popularity Contest application to production using Supabase and Vercel.

## Prerequisites

- Node.js 18+ installed
- Git installed
- A Supabase account
- A Vercel account
- A GitHub account (recommended for automatic deployments)

## Step 1: Set Up Supabase Project

### 1.1 Create a New Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: `popularity-contest` (or your preferred name)
   - **Database Password**: Generate a strong password and save it securely
   - **Region**: Choose the region closest to your users
5. Click "Create new project"
6. Wait for the project to be created (this may take a few minutes)

### 1.2 Get Project Configuration

Once your project is ready:

1. Go to **Settings** → **API**
2. Copy the following values (you'll need them later):
   - **Project URL** (something like `https://abcdefghijklmnop.supabase.co`)
   - **Project API Keys** → **anon public** key
   - **Project API Keys** → **service_role** key (keep this secret!)

## Step 2: Configure Database

### 2.1 Run Database Migrations

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your local project to your Supabase project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_ID
   ```
   Replace `YOUR_PROJECT_ID` with your project ID from the Supabase dashboard URL.

4. Push the database migrations:
   ```bash
   supabase db push
   ```

   This will run all migration files in the correct order:
   - Create users table with auth integration
   - Create tournaments, contestants, rounds, matchups tables
   - Create votes and results tables
   - Set up Row Level Security policies
   - Configure storage buckets
   - Create tournament logic functions

### 2.2 Verify Database Setup

1. Go to your Supabase dashboard
2. Navigate to **Table Editor**
3. Verify that all tables are created:
   - `users`
   - `tournaments`
   - `contestants`
   - `rounds`
   - `matchups`
   - `votes`
   - `results`

## Step 3: Configure Storage

### 3.1 Verify Storage Buckets

1. Go to **Storage** in your Supabase dashboard
2. Verify that the following buckets are created:
   - `tournament-images`
   - `contestant-images`
   - `user-avatars`

### 3.2 Configure Storage Policies

The storage policies should be automatically configured by the migration files. Verify in **Storage** → **Policies** that policies exist for:
- Public read access to tournament and contestant images
- Authenticated user access to upload avatars
- User-specific access to their own avatar uploads

## Step 4: Set Up Authentication

### 4.1 Configure Auth Settings

1. Go to **Authentication** → **Settings**
2. Under **General**:
   - **Site URL**: Add your production domain (e.g., `https://your-app.vercel.app`)
   - **Redirect URLs**: Add your production domain with auth callback paths
3. Under **Email**:
   - Configure your SMTP settings or use Supabase's default email service
   - Customize email templates if desired

### 4.2 Configure Social Providers (Optional)

If you want to add social login:

1. Go to **Authentication** → **Providers**
2. Enable desired providers (Google, GitHub, etc.)
3. Add your OAuth credentials from the respective providers

## Step 5: Environment Configuration

### 5.1 Create Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Analytics and monitoring
VITE_GA_TRACKING_ID=your_google_analytics_id
VITE_SENTRY_DSN=your_sentry_dsn

# Application Configuration
VITE_APP_NAME="Popularity Contest"
VITE_APP_DESCRIPTION="Create and participate in bracket-style popularity contests"
VITE_APP_URL=your_production_url
```

Replace the placeholders with your actual values from Step 1.2.

### 5.2 Verify Environment Variables

Test your environment configuration:

```bash
npm run dev
```

Ensure the application can connect to your Supabase project.

## Step 6: Deploy to Vercel

### 6.1 Prepare for Deployment

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. Your `package.json` already has the correct build scripts:
   ```json
   {
     "scripts": {
       "build": "tsc -b && vite build",
       "preview": "vite preview"
     }
   }
   ```

### 6.2 Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository: `https://github.com/BlitzAce71/popularity-contest`
4. Configure the project:
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build` (should be auto-detected)
   - **Output Directory**: `dist` (should be auto-detected)

### 6.3 Configure Environment Variables on Vercel

1. In your Vercel project settings, go to **Environment Variables**
2. Add these environment variables:

```
VITE_SUPABASE_URL=https://swinznpmsszgnhgjipvk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3aW56bnBtc3N6Z25oZ2ppcHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3NTUxODYsImV4cCI6MjA2NzMzMTE4Nn0._rWn3Lq_GnpGPyleYdFTZOSOPsOggrKpj9uO2q2YO0Q
VITE_APP_NAME=Popularity Contest
VITE_APP_DESCRIPTION=Create and participate in bracket-style popularity contests
VITE_APP_URL=https://your-vercel-app.vercel.app
```

3. Set these for all environments (Production, Preview, Development)

### 6.4 Deploy and Configure

1. Click "Deploy"
2. Wait for the deployment to complete
3. Copy your Vercel deployment URL (e.g., `https://popularity-contest-blitzace71.vercel.app`)
4. Update the `VITE_APP_URL` environment variable with your actual Vercel URL

## Step 7: Configure Custom Domain (Optional)

### 7.1 Add Custom Domain

1. In Vercel project settings, go to **Domains**
2. Add your custom domain
3. Configure DNS settings according to Vercel's instructions

### 7.2 Update Supabase Configuration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/swinznpmsszgnhgjipvk
2. Navigate to **Authentication** → **Settings**
3. Update the following settings:
   - **Site URL**: `https://your-vercel-app.vercel.app` (or your custom domain)
   - **Redirect URLs**: Add `https://your-vercel-app.vercel.app/**`

## Step 8: Post-Deployment Setup

### 8.1 Create Admin User

1. Register a new account on your deployed application
2. Go to your Supabase dashboard → **Table Editor** → `users`
3. Find your user record and set `is_admin` to `true`
4. You can now access the admin dashboard at `/admin`

### 8.2 Test Core Functionality

Test the following features:
- [ ] User registration and login
- [ ] Creating a tournament (as admin)
- [ ] Adding contestants to a tournament
- [ ] Starting a tournament
- [ ] Voting in matchups
- [ ] Viewing tournament bracket
- [ ] Admin dashboard functionality

### 8.3 Configure Monitoring (Optional)

Consider setting up:
- **Error tracking**: Sentry integration
- **Analytics**: Google Analytics
- **Performance monitoring**: Vercel Analytics
- **Uptime monitoring**: External service

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify your Supabase URL and API keys
- Check that RLS policies allow the intended access
- Ensure migrations ran successfully

**Authentication Issues**
- Verify Site URL and Redirect URLs in Supabase
- Check email confirmation settings
- Ensure proper environment variables

**Build Failures**
- Check for TypeScript errors: `npm run type-check`
- Verify all dependencies are installed
- Check Vercel build logs for specific errors

**Storage Upload Issues**
- Verify storage buckets exist
- Check storage policies
- Ensure proper file size limits

### Getting Help

- Check Supabase documentation: https://supabase.com/docs
- Check Vercel documentation: https://vercel.com/docs
- Review application logs in Vercel dashboard
- Check browser console for client-side errors

## Security Considerations

### Production Security Checklist

- [ ] All environment variables are properly configured
- [ ] Service role key is never exposed to the client
- [ ] RLS policies are properly configured and tested
- [ ] File upload limits are in place
- [ ] Rate limiting is configured (via Supabase or external service)
- [ ] HTTPS is enforced
- [ ] Error messages don't expose sensitive information
- [ ] Regular security updates are applied

### Ongoing Maintenance

- Monitor Supabase usage and billing
- Regularly update dependencies
- Monitor error rates and performance
- Backup database regularly (automatic with Supabase)
- Review and update security policies as needed

## Environment-Specific Configurations

### Development Environment
```env
VITE_SUPABASE_URL=http://localhost:54321  # If using local Supabase
VITE_SUPABASE_ANON_KEY=your_local_anon_key
```

### Staging Environment
```env
VITE_SUPABASE_URL=your_staging_supabase_url
VITE_SUPABASE_ANON_KEY=your_staging_anon_key
VITE_APP_URL=your_staging_vercel_url
```

### Production Environment
```env
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_anon_key
VITE_APP_URL=your_production_domain
```

---

**Success!** 🎉 Your Popularity Contest application should now be live and ready for users to create and participate in tournaments!