# 🏆 Popularity Contest - Tournament Voting Application

A modern React application built with Vite for creating and participating in bracket-style popularity contests. Create tournaments, add contestants, and let users vote in exciting head-to-head matchups!

[![Made with React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Powered by Supabase](https://img.shields.io/badge/Supabase-green.svg)](https://supabase.com/)
[![Styled with Tailwind](https://img.shields.io/badge/Tailwind_CSS-blue.svg)](https://tailwindcss.com/)

## ✨ Features

### 🎯 Core Functionality
- **Tournament Creation**: Multiple bracket formats (single elimination, double elimination, round-robin)
- **Real-time Voting**: Live voting with instant result updates
- **Bracket Visualization**: NCAA-style tournament brackets with mobile responsiveness
- **User Management**: Secure authentication with profile management
- **Image Support**: Upload and display contestant photos with optimized storage

### 🎨 User Experience
- **Responsive Design**: Mobile-first design that works on all devices
- **Real-time Updates**: Live voting results and tournament progress via Supabase subscriptions
- **Optimistic Updates**: Instant UI feedback with automatic rollback on errors
- **Auto-save**: Draft votes are automatically saved to prevent data loss
- **Toast Notifications**: User-friendly error handling and success messages

### 🔧 Admin Features
- **Admin Dashboard**: Complete tournament and user management
- **Contestant Management**: Add, edit, and organize tournament participants
- **Tournament Controls**: Start, pause, and manage tournament progression
- **User Administration**: Manage user roles and permissions
- **Analytics**: Tournament statistics and participation metrics

### 🚀 Technical Features
- **Progressive Web App**: Installable on mobile devices
- **SEO Optimized**: Comprehensive meta tags and social sharing
- **Error Boundaries**: Graceful error handling throughout the app
- **TypeScript**: Full type safety for reliable development
- **Performance Optimized**: Code splitting and bundle optimization

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **Forms**: React Hook Form + Zod validation
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage for images
- **Icons**: Lucide React

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm or yarn**: Package manager
- **Supabase Account**: For backend services

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd popularity-contest
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment configuration**:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase database**:
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login and link project
   supabase login
   supabase link --project-ref YOUR_PROJECT_ID
   
   # Push database migrations
   supabase db push
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Create your first admin user**:
   - Register an account in the app
   - Go to Supabase dashboard → Table Editor → `users`
   - Set `is_admin` to `true` for your user
   - Access admin dashboard at `/admin`

## 📚 Usage Guide

### For Users

1. **Browse Tournaments**: View active tournaments on the homepage
2. **Register/Login**: Create an account to participate in voting
3. **Vote in Matchups**: Click on tournament cards to view brackets and vote
4. **Track Progress**: See your voting progress and tournament results

### For Tournament Creators

1. **Access Admin Panel**: Navigate to `/admin` (requires admin permissions)
2. **Create Tournament**: Set up tournament details and format
3. **Add Contestants**: Upload contestant information and images
4. **Start Tournament**: Activate voting for the tournament
5. **Monitor Progress**: Track votes and manage tournament flow

### For Administrators

1. **User Management**: View and manage user accounts
2. **Tournament Oversight**: Monitor all tournaments and their status
3. **System Settings**: Configure application-wide settings
4. **Analytics**: View engagement and participation statistics

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, LoadingSpinner, etc.)
│   ├── layout/         # Layout components (Navigation, etc.)
│   ├── tournaments/    # Tournament-specific components
│   ├── brackets/       # Bracket visualization components
│   ├── voting/         # Voting interface components
│   └── admin/          # Admin dashboard components
├── pages/              # Page components
│   ├── tournament/     # Tournament-related pages
│   ├── bracket/        # Bracket-specific pages
│   ├── admin/          # Admin pages
│   └── auth/           # Authentication pages
├── hooks/              # Custom React hooks
├── contexts/           # React contexts (Auth, etc.)
├── lib/                # Third-party library configurations
├── services/           # API services
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── App.tsx             # Main application component
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint (if configured)

## Database Schema

The application expects the following Supabase tables:

### Users
- `id` (uuid, primary key)
- `email` (text, unique)
- `username` (text, unique)
- `firstName` (text)
- `lastName` (text)
- `avatarUrl` (text, nullable)
- `isAdmin` (boolean, default: false)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### Tournaments
- `id` (uuid, primary key)
- `title` (text)
- `description` (text)
- `imageUrl` (text, nullable)
- `status` (enum: 'draft', 'active', 'completed')
- `startDate` (timestamp)
- `endDate` (timestamp, nullable)
- `maxParticipants` (integer)
- `currentParticipants` (integer, default: 0)
- `bracketType` (enum: 'single-elimination', 'double-elimination', 'round-robin')
- `isPublic` (boolean, default: true)
- `createdBy` (uuid, foreign key to users)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### Contestants
- `id` (uuid, primary key)
- `tournamentId` (uuid, foreign key to tournaments)
- `name` (text)
- `description` (text, nullable)
- `imageUrl` (text, nullable)
- `seed` (integer)
- `isActive` (boolean, default: true)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_SUPABASE_STORAGE_BUCKET` | Storage bucket name | No |
| `VITE_APP_NAME` | Application name | No |
| `VITE_APP_DESCRIPTION` | Application description | No |

## 🚀 Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Quick Deploy to Vercel

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com) and import your GitHub repository
   - Set environment variables in Vercel dashboard
   - Deploy automatically

3. **Update Supabase settings**:
   - Add your Vercel URL to Supabase Auth settings
   - Update redirect URLs

### Environment Variables for Production

Set these in your deployment platform:

```env
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_anon_key
VITE_APP_URL=your_production_domain
VITE_APP_NAME="Popularity Contest"
```

## 🧪 Testing

```bash
# Run type checking
npm run type-check

# Build and preview
npm run build
npm run preview
```

## 📱 PWA Features

The application includes Progressive Web App features:

- **Installable**: Can be installed on mobile devices
- **Offline Ready**: Basic offline functionality
- **App Manifest**: Proper PWA manifest configuration
- **Service Worker**: Background sync capabilities (when implemented)

## 🔧 Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run type-check` | Run TypeScript type checking |

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow the coding standards
4. **Add tests**: Ensure new features are tested
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Submit a pull request**

### Development Guidelines

- Follow TypeScript best practices
- Use meaningful component and variable names
- Add proper error handling
- Include appropriate loading states
- Test your changes thoroughly
- Update documentation as needed

## 🐛 Troubleshooting

### Common Issues

**Build Errors**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Supabase Connection Issues**
- Verify your environment variables
- Check Supabase project status
- Ensure RLS policies are correctly configured

**TypeScript Errors**
```bash
# Run type checking
npm run type-check
```

**Performance Issues**
- Check browser dev tools for network issues
- Verify image optimization
- Review bundle size analysis

## 📊 Performance

The application is optimized for performance:

- **Bundle Size**: Optimized with code splitting
- **Loading**: Skeleton loaders and progressive loading
- **Caching**: Aggressive asset caching strategies
- **Images**: Optimized image delivery via Supabase Storage
- **Real-time**: Efficient WebSocket connections via Supabase

## 🔒 Security

- **Authentication**: Secure JWT-based authentication via Supabase
- **Authorization**: Row Level Security (RLS) policies
- **Input Validation**: Zod schema validation
- **XSS Protection**: React's built-in XSS protection
- **CSRF Protection**: SameSite cookie policies
- **File Upload**: Secure file upload with type validation

## 📈 Analytics & Monitoring

The application supports:

- **Google Analytics**: User behavior tracking
- **Error Tracking**: Sentry integration (optional)
- **Performance Monitoring**: Web Vitals tracking
- **Real-time Metrics**: Tournament participation analytics

## 🌐 Browser Support

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions
- **Mobile**: iOS Safari, Chrome Mobile

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React](https://react.dev/) - UI library
- [Supabase](https://supabase.com/) - Backend platform
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Lucide](https://lucide.dev/) - Icon library
- [Vite](https://vite.dev/) - Build tool

## 📞 Support

- **Documentation**: Check this README and [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

---

Made with ❤️ using React and Supabase