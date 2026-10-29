import { loadLibrary, type StudyContent } from "./content-service.ts";
import { resolveContentAccess, type ContentAccess } from "./content-access.ts";
import {
  accessibleSearchBody,
  searchDocuments,
  type SearchDocument,
} from "./search-index.ts";
import type { Locale } from "./i18n.ts";

export async function searchStudyLibrary(
  query: string,
  locale: Locale,
  userId?: string,
  subject = "",
  dependencies: {
    load?: (
      locale: Locale,
    ) => Promise<{ items: StudyContent[]; databaseAvailable: boolean }>;
    access?: (content: StudyContent, userId?: string) => Promise<ContentAccess>;
  } = {},
) {
  const load = dependencies.load || loadLibrary;
  const access = dependencies.access || resolveContentAccess;
  const libraries = await Promise.all([load("zh"), load("en")]);
  const seen = new Set<string>();
  const candidates = libraries
    .flatMap((library) => library.items)
    .filter((content) => {
      const key = `${content.slug}:${content.sourceLocale}`;
      if (
        seen.has(key) ||
        !content.isPublished ||
        !content.isPublic ||
        (subject && content.subjectSlug !== subject)
      )
        return false;
      seen.add(key);
      return true;
    });
  const documents = await Promise.all(
    candidates.map(async (content): Promise<SearchDocument | null> => {
      const permission = await access(content, userId);
      const body = accessibleSearchBody(
        content.body,
        permission,
        content.previewRatio,
      );
      return body === null
        ? null
        : {
            slug: content.slug,
            title: content.title,
            subjectSlug: content.subjectSlug,
            subjectTitle: content.subjectTitle,
            locale: content.sourceLocale,
            body,
          };
    }),
  );
  return {
    hits: searchDocuments(
      documents.filter((value): value is SearchDocument => value !== null),
      query,
      locale,
      subject,
    ),
    databaseAvailable: libraries.every((library) => library.databaseAvailable),
  };
}
