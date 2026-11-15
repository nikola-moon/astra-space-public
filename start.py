"""Launch the public ASTRA application locally or behind an HTTPS proxy."""

import argparse
import os
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '8010')))
    parser.add_argument('--check', action='store_true', help='Vérifier le parcours dans deux sessions isolées.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    if args.check:
        from smoke_test import check
        check(root)
        return

    import uvicorn

    station = root / 'station'
    if not (station / 'web' / 'index.html').is_file():
        parser.error('Export Expo Web manquant. Voir README.md et Construire_web.cmd.')
    sys.path.insert(0, str(station))
    host = os.environ.get('ASTRA_HOST', '127.0.0.1')
    if host == '127.0.0.1':
        print(f'ASTRA Space · http://{host}:{args.port}', flush=True)
    uvicorn.run('demo_app:app', host=host, port=args.port, workers=1, access_log=False)


if __name__ == '__main__':
    main()
