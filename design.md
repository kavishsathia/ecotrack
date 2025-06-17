i# EcoTrack Design Language & Guidelines

## 🎨 Design Philosophy

**"Government-Grade Transparency, Consumer-First Experience"**

EcoTrack follows Singapore's digital government design principles - clean, accessible, and trustworthy. Our design language balances institutional credibility with modern consumer expectations, creating interfaces that feel both authoritative and approachable.

## 🏛️ Core Design Principles

### 1. **Digital Government Standards**
- Follow Singapore Government Digital Service design principles
- Clean, functional interfaces with clear information hierarchy
- Consistent with gov.sg design patterns for familiar user experience

### 2. **Data-First Design**
- Information architecture that prioritizes clarity and actionability
- Visual hierarchy that guides users through complex sustainability data
- Progressive disclosure for expert-level insights

### 3. **Accessible by Default**
- WCAG 2.1 AA compliance minimum
- High contrast ratios and scalable interfaces
- Multi-language support ready (English, Mandarin, Malay, Tamil)

### 4. **Mobile-Government Integration**
- Seamless SingPass integration patterns
- Optimized for Singapore's mobile-first government services
- Consistent with existing gov.sg mobile experiences

## 🎨 Color Palette

### Primary Colors (Modern Government Green)
```css
--primary-700: #0F766E     /* Primary action - modern teal-green */
--primary-600: #0D9488     /* Interactive elements */
--primary-500: #14B8A6     /* Default primary */
--primary-400: #2DD4BF     /* Hover states */
--primary-300: #7DD3FC     /* Light accents */
--primary-100: #F0FDFA     /* Background tints */
--primary-50: #F8FAFC      /* Subtle backgrounds */
```

### Semantic Colors
```css
--success-600: #059669     /* Confirmation, high sustainability */
--warning-500: #F59E0B     /* Attention, medium sustainability */
--error-500: #DC2626      /* Alerts, low sustainability */
--info-500: #3B82F6       /* Information, neutral */
```

### Neutral Palette (Government Standard)
```css
--neutral-900: #111827     /* Primary text */
--neutral-700: #374151     /* Secondary text */
--neutral-500: #6B7280     /* Muted text */
--neutral-300: #D1D5DB     /* Borders */
--neutral-100: #F3F4F6     /* Light backgrounds */
--neutral-50: #F9FAFB      /* Page backgrounds */
--white: #FFFFFF
```

### Sustainability Score Palette
```css
--score-excellent: #059669  /* 85-100: Success green */
--score-good: #0891B2       /* 70-84: Info blue-green */
--score-fair: #F59E0B       /* 55-69: Warning amber */
--score-poor: #EF4444       /* 40-54: Error red-orange */
--score-critical: #DC2626   /* 0-39: Critical red */
```

## 🔤 Typography

### Primary Typeface: **Inter** (Government Standard)
- **Reasoning**: Used across Singapore government digital services
- **Usage**: All interface text, data displays, forms

### Font Scale (Type Scale)
```css
--text-xs: 12px/16px      /* Captions, metadata */
--text-sm: 14px/20px      /* Small text, secondary info */
--text-base: 16px/24px    /* Body text, paragraphs */
--text-lg: 18px/28px      /* Emphasized text */
--text-xl: 20px/28px      /* Section headings */
--text-2xl: 24px/32px     /* Page headings */
--text-3xl: 30px/36px     /* Hero headings */
--text-4xl: 36px/40px     /* Display headings */

/* All use Inter font family */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Font Weights
```css
--font-normal: 400        /* Body text */
--font-medium: 500        /* Emphasized text, labels */
--font-semibold: 600      /* Headings, buttons */
--font-bold: 700          /* Strong emphasis only */
```

## 🧩 Component Design System

### Buttons (Government Style)

#### Primary Button (SingPass)
```css
.btn-primary {
  background-color: #DC2626; /* SingPass red - keep for familiarity */
  color: white;
  border: none;
  border-radius: 6px;
  padding: 12px 20px;
  font: 500 16px/20px Inter;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background-color: #B91C1C;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

#### Secondary Button (EcoTrack Actions)
```css
.btn-secondary {
  background-color: #0F766E;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 12px 20px;
  font: 500 16px/20px Inter;
}

.btn-secondary:hover {
  background-color: #0D9488;
}
```

#### Outline Button
```css
.btn-outline {
  background-color: transparent;
  color: #0F766E;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  padding: 11px 19px; /* Account for border */
  font: 500 16px/20px Inter;
}

.btn-outline:hover {
  border-color: #0F766E;
  background-color: #F0FDFA;
}
```

### Form Elements (Government Standard)

#### Input Fields
```css
.form-input {
  background-color: white;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  padding: 12px 16px;
  font: 400 16px/20px Inter;
  color: #111827;
  width: 100%;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: #0F766E;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
}
```

#### Labels
```css
.form-label {
  font: 500 14px/20px Inter;
  color: #374151;
  margin-bottom: 6px;
  display: block;
}
```

### Cards

#### Standard Card
```css
.card {
  background-color: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-hover {
  transition: all 0.15s ease;
}

.card-hover:hover {
  border-color: #0F766E;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
}
```

#### Score Display Card
```css
.score-card {
  background: linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%);
  border: 1px solid #14B8A6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}
```

## 🎯 Iconography (Government Style)

### Icon Library
- **Source**: Heroicons (used by Tailwind/government sites)
- **Style**: Outline style (2px stroke)
- **Sizes**: 16px, 20px, 24px
- **Color**: Inherit from parent or use `--neutral-500`

### Key Icons
```
📊 Analytics: ChartBarIcon
🎯 Goals: TargetIcon  
🔄 Lifecycle: ArrowPathIcon
✅ Verified: CheckBadgeIcon
⚡ Efficiency: BoltIcon
🌍 Impact: GlobeAltIcon
📱 Mobile: DevicePhoneMobileIcon
🏛️ Government: BuildingLibraryIcon
```

## 📱 Layout System

### Grid & Spacing
```css
/* 4px base unit (government standard) */
--space-0: 0px
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

### Container Widths
```css
--container-sm: 640px   /* Mobile forms */
--container-md: 768px   /* Tablet layouts */
--container-lg: 1024px  /* Desktop standard */
--container-xl: 1280px  /* Wide dashboards */
```

### Border Radius Scale
```css
--rounded-sm: 2px      /* Minimal rounding */
--rounded: 4px         /* Small elements */
--rounded-md: 6px      /* Default (buttons, inputs) */
--rounded-lg: 8px      /* Cards, containers */
--rounded-xl: 12px     /* Large cards */
--rounded-full: 50%    /* Circular */
```

## 🎭 Brand Personality (Government-Aligned)

### Voice & Tone
- **Authoritative but approachable**: Clear, confident guidance
- **Transparent**: Honest about data sources and methodology  
- **Empowering**: Help citizens make informed decisions
- **Inclusive**: Accessible to all education and tech comfort levels

### Visual Characteristics
- **Clean & Functional**: Purpose-driven design with no decoration for decoration's sake
- **Trustworthy**: Consistent with familiar government digital services
- **Modern**: Contemporary but not trendy - timeless government aesthetic
- **Accessible**: High contrast, clear hierarchy, screen reader friendly

## 🌟 Interaction Patterns

### Government-Style Interactions
```css
/* Subtle, professional animations */
.transition-base {
  transition-property: background-color, border-color, color, box-shadow;
  transition-duration: 0.15s;
  transition-timing-function: ease-in-out;
}

/* Focus states for accessibility */
.focus-ring:focus {
  outline: 2px solid #0F766E;
  outline-offset: 2px;
}
```

### Loading States
- **Skeleton Loading**: Gray placeholder shapes
- **Spinners**: Simple circular progress in primary color
- **Progress Bars**: Linear progress with primary fill

## 📊 Data Visualization

### Chart Color Scheme
```css
/* Primary data series */
--chart-primary: #0F766E
--chart-secondary: #14B8A6  
--chart-tertiary: #2DD4BF

/* Multi-series charts */
--chart-series: [
  #0F766E,  /* Primary green */
  #3B82F6,  /* Blue */
  #F59E0B,  /* Amber */
  #EF4444,  /* Red */
  #8B5CF6,  /* Purple */
  #10B981   /* Emerald */
]
```

### Chart Guidelines
- Use consistent scales and spacing
- Include clear labels and legends
- Ensure accessibility with patterns/textures for color-blind users
- Keep government data visualization best practices

## 🔧 Implementation Framework

### CSS Architecture
```css
/* Utility-first approach (Tailwind-inspired) */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* Custom government theme overrides */
:root {
  --primary: 15 118 110;     /* HSL for --primary-700 */
  --secondary: 107 114 128;   /* HSL for --neutral-500 */
  --background: 249 250 251;  /* HSL for --neutral-50 */
  --foreground: 17 24 39;     /* HSL for --neutral-900 */
}
```

### Component Naming Convention
```css
/* Block Element Modifier (BEM) with government prefix */
.sg-button { }
.sg-button--primary { }
.sg-button--secondary { }
.sg-card { }
.sg-card__header { }
.sg-card__content { }
```

## 📱 Responsive Design

### Breakpoint System (Government Standard)
```css
/* Mobile-first responsive design */
--breakpoint-sm: 640px   /* Small tablets */
--breakpoint-md: 768px   /* Tablets */
--breakpoint-lg: 1024px  /* Laptops */
--breakpoint-xl: 1280px  /* Desktops */
```

### Mobile Optimization
- Touch targets minimum 44px
- Thumb-friendly navigation zones
- Reduced cognitive load on smaller screens
- SingPass mobile integration patterns

## 🎨 Updated Login Page Design

```html
<!-- Clean, government-style login -->
<div class="min-h-screen bg-neutral-50 flex">
  <!-- Left panel - branding -->
  <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-700 to-primary-500 items-center justify-center">
    <div class="text-center text-white p-12">
      <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg class="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
          <!-- Chart/analytics icon -->
        </svg>
      </div>
      <h1 class="text-3xl font-semibold mb-4">EcoTrack</h1>
      <p class="text-xl text-primary-100">Sustainable Shopping Intelligence</p>
      <div class="mt-8 space-y-3 text-left">
        <div class="flex items-center text-primary-100">
          <svg class="w-5 h-5 mr-3"><!-- check icon --></svg>
          Real-time sustainability scoring
        </div>
        <div class="flex items-center text-primary-100">
          <svg class="w-5 h-5 mr-3"><!-- check icon --></svg>
          Product lifecycle tracking
        </div>
        <div class="flex items-center text-primary-100">
          <svg class="w-5 h-5 mr-3"><!-- check icon --></svg>
          Eco-friendly rewards program
        </div>
      </div>
    </div>
  </div>
  
  <!-- Right panel - login form -->
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-semibold text-neutral-900">Welcome back</h2>
        <p class="text-neutral-600 mt-2">Sign in to track your sustainable shopping journey</p>
      </div>
      
      <!-- SingPass button (keep red for familiarity) -->
      <button class="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-md transition-colors mb-4">
        <svg class="w-5 h-5 inline mr-2"><!-- SingPass icon --></svg>
        Continue with SingPass
      </button>
      
      <div class="relative mb-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-neutral-300"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-neutral-50 text-neutral-500">Or continue with email</span>
        </div>
      </div>
      
      <!-- Email form (clean government style) -->
      <form class="space-y-4">
        <div>
          <label class="form-label">Email address</label>
          <input type="email" class="form-input" placeholder="Enter your email">
        </div>
        <div>
          <label class="form-label">Password</label>
          <input type="password" class="form-input" placeholder="Enter your password">
        </div>
        <button type="submit" class="btn-secondary w-full">Sign in</button>
      </form>
      
      <p class="text-center text-sm text-neutral-600 mt-6">
        Don't have an account? <a href="#" class="text-primary-600 hover:text-primary-700">Sign up</a>
      </p>
    </div>
  </div>
</div>
```

This design language creates a professional, government-grade appearance while maintaining modern usability and the trustworthy feel needed for handling personal data and sustainability information.
