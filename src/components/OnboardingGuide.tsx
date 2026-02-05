"use client";

import { useState, useEffect } from "react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to OmniSense Core",
    description: "Your AI-powered meeting assistant that provides real-time coaching and insights through your earphones.",
    position: "center"
  },
  {
    id: "consent",
    title: "Enable AI Assistance",
    description: "First, we need your permission to access camera and microphone for real-time analysis.",
    action: "Click 'Enable' to grant permissions",
    targetSelector: "[data-testid='consent-enable']",
    position: "bottom"
  },
  {
    id: "privacy",
    title: "Choose Your Privacy Mode",
    description: "Cloud mode provides full AI features. Local mode works offline. Off mode disables analysis.",
    action: "Select 'Cloud' for the best experience",
    targetSelector: "select[title*='Privacy']",
    position: "bottom"
  },
  {
    id: "voice",
    title: "Enable Voice Output",
    description: "Get real-time coaching directly in your earphones. Toggle between text and voice output.",
    action: "Select 'Voice' and enable 'Conversational Voice'",
    targetSelector: "select[title*='Output']",
    position: "bottom"
  },
  {
    id: "monitoring",
    title: "Start Monitoring",
    description: "The AI will now analyze your speaking patterns, interruptions, and engagement levels.",
    action: "Speak naturally and watch the real-time suggestions",
    targetSelector: ".video-container",
    position: "top"
  },
  {
    id: "suggestions",
    title: "Receive Real-time Coaching",
    description: "Get instant feedback about your speaking patterns, interruptions, and meeting engagement.",
    action: "Listen for voice coaching in your earphones",
    targetSelector: ".suggestions-container",
    position: "top"
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "OmniSense is now actively coaching you. Check the suggestions panel for real-time insights.",
    action: "Start your meeting with AI assistance",
    position: "center"
  }
];

interface OnboardingGuideProps {
  onComplete: () => void;
  currentStep?: number;
  onStepChange?: (step: number) => void;
}

export default function OnboardingGuide({ onComplete, currentStep = 0, onStepChange }: OnboardingGuideProps) {
  const [activeStep, setActiveStep] = useState(currentStep);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [spotlightPosition, setSpotlightPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const step = onboardingSteps[activeStep];

  useEffect(() => {
    if (step.targetSelector) {
      const element = document.querySelector(step.targetSelector);
      setHighlightedElement(element || null);
      
      if (element) {
        const rect = element.getBoundingClientRect();
        setSpotlightPosition({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
    } else {
      setHighlightedElement(null);
      setSpotlightPosition({ x: 0, y: 0, width: 0, height: 0 });
    }
  }, [step, activeStep]);

  const nextStep = () => {
    if (activeStep < onboardingSteps.length - 1) {
      const next = activeStep + 1;
      setActiveStep(next);
      onStepChange?.(next);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (activeStep > 0) {
      const prev = activeStep - 1;
      setActiveStep(prev);
      onStepChange?.(prev);
    }
  };

  const skipOnboarding = () => {
    onComplete();
  };

  const getPositionClasses = () => {
    switch (step.position) {
      case "top":
        return "bottom-full mb-4 left-1/2 transform -translate-x-1/2";
      case "bottom":
        return "top-full mt-4 left-1/2 transform -translate-x-1/2";
      case "left":
        return "right-full mr-4 top-1/2 transform -translate-y-1/2";
      case "right":
        return "left-full ml-4 top-1/2 transform -translate-y-1/2";
      case "center":
        return "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
      default:
        return "bottom-full mb-4 left-1/2 transform -translate-x-1/2";
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
      
      {/* Spotlight */}
      {highlightedElement && (
        <div
          className="absolute border-4 border-emerald-500 rounded-lg shadow-2xl pointer-events-none transition-all duration-300"
          style={{
            left: `${spotlightPosition.x - 8}px`,
            top: `${spotlightPosition.y - 8}px`,
            width: `${spotlightPosition.width + 16}px`,
            height: `${spotlightPosition.height + 16}px`,
          }}
        >
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Tooltip */}
      <div
        className={`absolute bg-white rounded-xl shadow-2xl p-6 max-w-sm pointer-events-auto ${getPositionClasses()}`}
        style={{
          ...(step.position === "center" && {
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)"
          })
        }}
      >
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-zinc-500">Step {activeStep + 1} of {onboardingSteps.length}</span>
            <button
              onClick={skipOnboarding}
              className="text-xs text-zinc-500 hover:text-zinc-700 underline"
            >
              Skip tour
            </button>
          </div>
          <div className="w-full bg-zinc-200 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((activeStep + 1) / onboardingSteps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">{step.title}</h3>
          <p className="text-sm text-zinc-600 mb-3">{step.description}</p>
          {step.action && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs text-emerald-800 font-medium">
                💡 {step.action}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={activeStep === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeStep === 0
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
            }`}
          >
            Previous
          </button>
          <button
            onClick={nextStep}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            {activeStep === onboardingSteps.length - 1 ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
