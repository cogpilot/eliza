/**
 * License page - GPL-3.0 + Apache-2.0 dual license display
 */

import { useState } from 'react';

interface LicenseProps {
  onBack: () => void;
  onAccept: () => void;
}

const GPL_LICENSE = `GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>

Everyone is permitted to copy and distribute verbatim copies of this license
document, but changing it is not allowed.

PREAMBLE

The GNU General Public License is a free, copyleft license for software and
other kinds of works.

The licenses for most software and other practical works are designed to take
away your freedom to share and change the works. By contrast, the GNU General
Public License is intended to guarantee your freedom to share and change all
versions of a program--to make sure it remains free software for all its users.

...

[Full GPL-3.0 license text would be included here]
`;

const APACHE_LICENSE = `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

"License" shall mean the terms and conditions for use, reproduction, and
distribution as defined by Sections 1 through 9 of this document.

"Licensor" shall mean the copyright owner or entity authorized by the copyright
owner that is granting the License.

...

[Full Apache-2.0 license text would be included here]
`;

const TAILS_ATTRIBUTION = `elizaOS is built on technology from the Tails Project.

Tails is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

For more information about Tails, visit: https://tails.net/

The Tails developers deserve our thanks for their work on privacy-focused
computing.`;

export function License({ onBack, onAccept }: LicenseProps) {
  const [accepted, setAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState<'gpl' | 'apache' | 'attribution'>('gpl');

  return (
    <div className="installer-page license-page">
      <h2>License Agreement</h2>
      <p className="license-intro">
        elizaOS is dual-licensed under GPL-3.0 and Apache-2.0. Please review the
        terms before continuing.
      </p>

      <div className="license-tabs">
        <button
          type="button"
          className={`license-tab ${activeTab === 'gpl' ? 'active' : ''}`}
          onClick={() => setActiveTab('gpl')}
        >
          GPL-3.0
        </button>
        <button
          type="button"
          className={`license-tab ${activeTab === 'apache' ? 'active' : ''}`}
          onClick={() => setActiveTab('apache')}
        >
          Apache-2.0
        </button>
        <button
          type="button"
          className={`license-tab ${activeTab === 'attribution' ? 'active' : ''}`}
          onClick={() => setActiveTab('attribution')}
        >
          Attribution
        </button>
      </div>

      <div className="license-content">
        <pre className="license-text">
          {activeTab === 'gpl' && GPL_LICENSE}
          {activeTab === 'apache' && APACHE_LICENSE}
          {activeTab === 'attribution' && TAILS_ATTRIBUTION}
        </pre>
      </div>

      <div className="license-accept">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            I have read and accept the license terms
          </span>
        </label>
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
          onClick={onAccept}
          disabled={!accepted}
          className="installer-button primary"
        >
          I Accept
        </button>
      </div>
    </div>
  );
}
