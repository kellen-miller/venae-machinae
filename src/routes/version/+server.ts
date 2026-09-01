import { json } from '@sveltejs/kit';

import { APPLICATION_VERSIONS } from '$lib/version/version-registry';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  return json(
    { application: APPLICATION_VERSIONS.application },
    {
      headers: {
        'cache-control': 'no-store'
      }
    }
  );
};
