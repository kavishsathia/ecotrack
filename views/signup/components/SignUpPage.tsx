'use client';

import { SignUpForm } from './SignUpForm';

interface SignUpPageProps {
  onSignUp?: (email: string, password: string, name?: string) => void;
  isLoading?: boolean;
}

export function SignUpPage({ onSignUp, isLoading = false }: SignUpPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-700 to-teal-500 items-center justify-center" style={{background: 'linear-gradient(to bottom right, #0F766E, #14B8A6)'}}>
        <div className="text-center text-white p-12 max-w-md">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <EcoTrackIcon className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-semibold mb-4">EcoTrack</h1>
          <p className="text-xl text-teal-100 mb-8">Sustainable Shopping Intelligence</p>
          <div className="space-y-4 text-left">
            <FeaturePoint text="Track your carbon footprint" />
            <FeaturePoint text="Get sustainability recommendations" />
            <FeaturePoint text="Earn rewards for eco-friendly choices" />
          </div>
        </div>
      </div>
      
      {/* Right panel - signup form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <SignUpForm 
          onSignUp={onSignUp}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function EcoTrackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3 13h8V3H9v6H5V3H3v10zm0 8h8v-6H9v4H5v-4H3v6zm8 0h8V11h-2v8h-4v-8h-2v10zm0-12h8V3h-2v6h-4V3h-2v6z"/>
    </svg>
  );
}

function FeaturePoint({ text }: { text: string }) {
  return (
    <div className="flex items-center text-teal-100">
      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}