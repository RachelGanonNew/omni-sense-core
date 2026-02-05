"use client";

interface ProgressStep {
  id: string;
  label: string;
  completed: boolean;
  current: boolean;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  className?: string;
}

export default function ProgressIndicator({ steps, className = "" }: ProgressIndicatorProps) {
  return (
    <div className={`flex items-center justify-center space-x-1 ${className}`}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          {/* Step label only - no circles */}
          <span
            className={`
              px-3 py-1 text-xs font-medium rounded-full transition-all duration-300
              ${step.completed 
                ? 'bg-emerald-500 text-white' 
                : step.current 
                  ? 'bg-emerald-100 border-2 border-emerald-500 text-emerald-700' 
                  : 'bg-zinc-200 text-zinc-500'
              }
            `}
          >
            {step.label}
          </span>
          
          {/* Connector line */}
          {index < steps.length - 1 && (
            <div className="w-6 h-0.5 mx-1">
              <div
                className={`
                  h-full transition-all duration-300
                  ${step.completed ? 'bg-emerald-500' : 'bg-zinc-300'}
                `}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
