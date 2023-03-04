import * as vscode from 'vscode';
import { customQuery, projectInRepository } from '../../test_utils/entities';

import { CustomQueryItemModel } from './custom_query_item_model';

describe('CustomQueryItem', () => {
  let item: vscode.TreeItem;

  describe('item labeled as a query', () => {
    beforeEach(() => {
      item = new CustomQueryItemModel(customQuery, projectInRepository).getTreeItem();
    });

    it('should have query name as label', () => {
      expect(item.label).toBe('Query name');
    });

    it('should have filter icon', () => {
      expect(item.iconPath).toEqual(new vscode.ThemeIcon('filter'));
    });
  });
});
