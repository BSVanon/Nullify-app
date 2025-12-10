import React from 'react'

function WorkflowStepIndicator({ step }) {
  const steps = [
    { label: 'Wallet' },
    { label: 'Upload' },
    { label: 'Encrypt' },
    { label: 'CT' },
    { label: 'DT' }
  ]

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {steps.map((item, idx) => {
          const currentStep = idx + 1
          return (
            <React.Fragment key={item.label}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${
                  step >= currentStep
                    ? 'bg-yellow-300 dark:bg-yellow-200 border-black text-gray-900'
                    : 'bg-gray-200 dark:bg-gray-700 border-gray-400 text-gray-500'
                }`}
              >
                {currentStep}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 transition-colors ${
                    step > currentStep ? 'bg-yellow-300 dark:bg-yellow-200' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 px-1">
        {steps.map(item => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

export default WorkflowStepIndicator
