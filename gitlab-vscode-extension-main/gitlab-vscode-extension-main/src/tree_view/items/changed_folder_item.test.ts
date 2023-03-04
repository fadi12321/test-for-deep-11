import { TreeItem } from 'vscode';
import { diffFile, mr, mrVersion } from '../../test_utils/entities';
import { ChangedFileItem } from './changed_file_item';
import { ChangedFolderItem, FolderTreeItem } from './changed_folder_item';

const createFolderTreeItems = (files: string[]): FolderTreeItem[] =>
  files.map(path => ({
    path,
    item: new ChangedFileItem(
      mr,
      {
        ...mrVersion,
        diffs: files.map(file => ({
          ...diffFile,
          old_path: file,
          new_path: file,
        })),
      },
      {
        ...diffFile,
        old_path: path,
        new_path: path,
      },
      '/repo',
      () => false,
    ),
  }));

const checkIsFolder: (
  item: TreeItem,
  name: string,
  path: string,
) => asserts item is ChangedFolderItem = (item, name, path) => {
  expect(item).toBeInstanceOf(ChangedFolderItem);
  expect(item.label).toStrictEqual(name);
  expect(item.resourceUri?.path).toStrictEqual(path);
};

describe('ChangedFolderItem', () => {
  it('should parse single folder correctly', () => {
    const files = createFolderTreeItems(['folder/test.js']);

    let items = new ChangedFolderItem('', files).getChildren();
    expect(items).toHaveLength(1);
    checkIsFolder(items[0], 'folder', 'folder');

    items = items[0].getChildren();
    expect(items).toHaveLength(1);
    expect(items[0]).toStrictEqual(files[0].item);
  });

  it('should parse nested folders correctly', () => {
    const files = createFolderTreeItems(['folder1/folder2/folder3/folder4/folder5/test.txt']);

    let items = new ChangedFolderItem('', files).getChildren();
    expect(items).toHaveLength(1);
    checkIsFolder(
      items[0],
      'folder1/folder2/folder3/folder4/folder5',
      'folder1/folder2/folder3/folder4/folder5',
    );

    items = items[0].getChildren();
    expect(items).toHaveLength(1);
    expect(items[0]).toStrictEqual(files[0].item);
  });

  it('should parse only root files correctly', () => {
    const files = createFolderTreeItems(['file1', 'file2']);

    const items = new ChangedFolderItem('', files).getChildren();
    expect(items).toHaveLength(2);
    expect(items[0]).toStrictEqual(files[0].item);
    expect(items[1]).toStrictEqual(files[1].item);
  });

  it('should parse multiple files correctly', () => {
    const files = createFolderTreeItems([
      'folder1/file2',
      'folder2/folder3/folder4/folder5/file4',
      'folder2/folder3/file3',
      'file1',
    ]);

    const items = new ChangedFolderItem('', files).getChildren();
    expect(items).toHaveLength(3);
    checkIsFolder(items[0], 'folder1', 'folder1');
    checkIsFolder(items[1], 'folder2/folder3', 'folder2/folder3');
    expect(items[2]).toStrictEqual(files[3].item);

    const folder1 = items[0].getChildren();
    expect(folder1).toHaveLength(1);
    expect(folder1[0]).toStrictEqual(files[0].item);

    const folder3 = items[1].getChildren();
    expect(folder3).toHaveLength(2);
    checkIsFolder(folder3[0], 'folder4/folder5', 'folder2/folder3/folder4/folder5');
    expect(folder3[1]).toStrictEqual(files[2].item);

    const folder5 = folder3[0].getChildren();
    expect(folder5).toHaveLength(1);
    expect(folder5[0]).toStrictEqual(files[1].item);
  });
});
