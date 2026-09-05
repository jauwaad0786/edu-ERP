import os
from app import create_app

env = os.environ.get('FLASK_ENV', 'production')
app = create_app(env)

if __name__ == '__main__':
    is_debug = env == 'development'
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=is_debug)
