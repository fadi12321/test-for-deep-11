import * as vscode from 'vscode';
import { getStopSequences } from './get_stop_sequences';

const TextDocument = class {
  constructor(text: string) {
    this.text = text;
    this.lineCount = text.split('\n').length;
  }

  text: any;

  lineCount: number;

  public lineAt(position: number) {
    return {
      text: this.text.split('\n')[position],
    };
  }
};

describe('getStopSequences', () => {
  it.each([
    ['import pandas as pd\nimport numpy as np', 0, 2, ['import numpy as np']],
    ['import pandas as pd\nimport numpy as np', 1, 2, []],
    ['import pandas as pd\nimport numpy as np', 2, 2, []],
    ['import pandas as pd\nimport numpy as np\nimport os', 1, 3, ['import os']],
  ])(
    'gets stop sequences',
    (text: string, position: number, lineCount: number, stopSequence: string[]) => {
      const doc = new TextDocument(text);
      const stopSequences = getStopSequences(position, doc as unknown as vscode.TextDocument);
      expect(doc.lineCount).toBe(lineCount);
      expect(stopSequences).toStrictEqual(stopSequence);
    },
  );
});
