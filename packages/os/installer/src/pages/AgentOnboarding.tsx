/**
 * AgentOnboarding page - Configure elizaOS AI agent
 */

import type { AgentConfig, InstallConfig } from '../backend/types';

interface AgentOnboardingProps {
  agent: AgentConfig;
  onDisplayNameChange: (name: string) => void;
  onProviderTypeChange: (type: InstallConfig['agent']['providerType']) => void;
  onApiKeyChange: (key: string) => void;
  onEnableVoiceChange: (enabled: boolean) => void;
  onEnableTelemetryChange: (enabled: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

const PROVIDER_OPTIONS: {
  value: InstallConfig['agent']['providerType'];
  name: string;
  description: string;
  icon: string;
  requiresApiKey: boolean;
}[] = [
  {
    value: 'none',
    name: 'Configure Later',
    description: 'Skip AI setup for now. You can configure providers after installation.',
    icon: '⏭️',
    requiresApiKey: false,
  },
  {
    value: 'local',
    name: 'Local AI',
    description: 'Run AI models locally on your machine. Requires GPU for best performance.',
    icon: '🖥️',
    requiresApiKey: false,
  },
  {
    value: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Use Claude models from Anthropic. Requires API key and internet.',
    icon: '🧠',
    requiresApiKey: true,
  },
  {
    value: 'openai',
    name: 'OpenAI (GPT)',
    description: 'Use GPT models from OpenAI. Requires API key and internet.',
    icon: '💡',
    requiresApiKey: true,
  },
];

export function AgentOnboarding({
  agent,
  onDisplayNameChange,
  onProviderTypeChange,
  onApiKeyChange,
  onEnableVoiceChange,
  onEnableTelemetryChange,
  onBack,
  onNext,
}: AgentOnboardingProps) {
  const selectedProvider = PROVIDER_OPTIONS.find(
    (p) => p.value === agent.providerType
  );

  return (
    <div className="installer-page agent-onboarding-page">
      <h2>Set Up Your AI Assistant</h2>
      <p className="page-description">
        Configure how your elizaOS AI agent works.
      </p>

      <div className="form-section">
        <h3>Agent Identity</h3>

        <div className="form-group">
          <label htmlFor="agent-name">What should I call your agent?</label>
          <input
            id="agent-name"
            type="text"
            value={agent.displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="Eliza"
            className="installer-input"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>AI Provider</h3>
        <p className="section-description">
          Choose how your agent processes conversations.
        </p>

        <div className="provider-options">
          {PROVIDER_OPTIONS.map((provider) => (
            <button
              key={provider.value}
              type="button"
              className={`provider-card ${
                agent.providerType === provider.value ? 'selected' : ''
              }`}
              onClick={() => onProviderTypeChange(provider.value)}
            >
              <div className="provider-icon">{provider.icon}</div>
              <div className="provider-content">
                <h4>{provider.name}</h4>
                <p>{provider.description}</p>
              </div>
              <div className="provider-radio">
                <div
                  className={`radio-indicator ${
                    agent.providerType === provider.value ? 'checked' : ''
                  }`}
                />
              </div>
            </button>
          ))}
        </div>

        {selectedProvider?.requiresApiKey && (
          <div className="form-group api-key-group">
            <label htmlFor="api-key">API Key</label>
            <input
              id="api-key"
              type="password"
              value={agent.apiKey || ''}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={`Enter your ${selectedProvider.name} API key`}
              className="installer-input"
            />
            <span className="form-hint">
              Your API key is stored securely and only used locally
            </span>
          </div>
        )}
      </div>

      <div className="form-section">
        <h3>Features</h3>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={agent.enableVoice}
              onChange={(e) => onEnableVoiceChange(e.target.checked)}
            />
            <span>
              <strong>Enable Voice</strong>
              <br />
              <small>
                Use speech-to-text and text-to-speech for voice conversations
              </small>
            </span>
          </label>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={agent.enableTelemetry}
              onChange={(e) => onEnableTelemetryChange(e.target.checked)}
            />
            <span>
              <strong>Help Improve elizaOS</strong>
              <br />
              <small>
                Share anonymous usage data to help us improve (no conversations
                are shared)
              </small>
            </span>
          </label>
        </div>
      </div>

      <div className="installer-actions">
        <button
          type="button"
          onClick={onBack}
          className="installer-button secondary"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="installer-button primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
