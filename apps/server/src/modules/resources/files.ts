import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { Resource } from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { resourceFiles } from '../../db/schema.js';
import type { Author } from '../../lib/author.js';
import { newId } from '../../lib/ids.js';
import type { ResourceService } from './service.js';

/**
 * The bytes behind a resource.
 *
 * A resource that is a file points at bytes on the server. The row that says
 * where they are lives in `resource_files`, and the resource's own data says
 * what the file is — its name, its content type, its size — and nothing about
 * the server's filesystem.
 *
 * The file's name in the workspace is the resource's title, so a file the
 * owner uploaded is a document whose title is the name of the file.
 */

export interface StoredFile {
  id: string;
  resourceId: string;
  /** Where the bytes live. The browser is never told this. */
  path: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface ResourceFilesService {
  /**
   * Store the bytes, and the resource that points at them.
   *
   * The resource row and the file row are written in one transaction, so a
   * resource never points at bytes that were not stored.
   */
  store(input: {
    workspaceId: string;
    title: string;
    filename: string;
    mimeType: string;
    bytes: Buffer;
    author: Author;
  }): { resource: Resource; file: StoredFile };
  /** The stored file of a resource, when it has one. */
  find(resourceId: string): StoredFile | null;
}

export interface ResourceFilesOptions {
  db: Database;
  resources: ResourceService;
  /** The directory the bytes are written to. */
  filesDir: string;
}

export function createResourceFilesService(options: ResourceFilesOptions): ResourceFilesService {
  const { db, resources, filesDir } = options;

  return {
    store(input) {
      fs.mkdirSync(filesDir, { recursive: true });

      // The bytes are written inside the transaction, because the path is
      // derived from the resource's id and the resource is created in it. A
      // write that fails takes the file with it, so a half-written upload
      // leaves no bytes behind for a resource that does not exist.
      let written: string | null = null;
      try {
        return db.transaction((tx) => {
          const resource = resources.create({
            workspaceId: input.workspaceId,
            type: 'document',
            title: input.title,
            data: {
              kind: 'file',
              filename: input.filename,
              mimeType: input.mimeType,
              size: input.bytes.length,
            },
            author: input.author,
          });

          written = path.join(filesDir, resource.id);
          fs.writeFileSync(written, input.bytes);

          const file: StoredFile = {
            id: newId('rfile'),
            resourceId: resource.id,
            path: written,
            mimeType: input.mimeType,
            size: input.bytes.length,
            createdAt: new Date().toISOString(),
          };
          tx.insert(resourceFiles).values(file).run();
          return { resource, file };
        });
      } catch (error) {
        if (written) fs.rmSync(written, { force: true });
        throw error;
      }
    },

    find(resourceId) {
      const row = db
        .select()
        .from(resourceFiles)
        .where(eq(resourceFiles.resourceId, resourceId))
        .get();
      return row ?? null;
    },
  };
}
