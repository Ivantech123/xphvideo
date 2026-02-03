import DOMPurify from 'dompurify';

let hooksInstalled = false;

const ensureHooks = () => {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Force safe links in injected HTML (prevents tabnabbing).
    if (node instanceof HTMLAnchorElement) {
      const href = node.getAttribute('href') || '';
      const isHttp = /^https?:\/\//i.test(href);
      if (isHttp) node.setAttribute('target', '_blank');
      if (isHttp || href.startsWith('//')) {
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
  });
};

export const sanitizeHtml = (input: string): string => {
  ensureHooks();

  return DOMPurify.sanitize(input || '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style', 'srcset', 'onerror', 'onclick', 'onload'],
  }) as string;
};

