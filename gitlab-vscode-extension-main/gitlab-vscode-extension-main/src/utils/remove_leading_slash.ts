/** VS Code Uri returns absolute path (leading slash) but GitLab uses relative paths (no leading slash) */
export const removeLeadingSlash = (filePath = ''): string => filePath.replace(/^\//, '');
