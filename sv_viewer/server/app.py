import os
import json
import requests
from flask import Flask, jsonify, send_from_directory

app = Flask(__name__, static_folder=os.getenv('STATIC_DIR', None))

CONNECTION_NAME = os.getenv('SNOWFLAKE_CONNECTION_NAME', 'default')
SNOWFLAKE_HOST = os.getenv('SNOWFLAKE_HOST')
SNOWFLAKE_WAREHOUSE = os.getenv('SNOWFLAKE_WAREHOUSE', 'COMPUTE_WH')
TOKEN_PATH = '/snowflake/session/token'

def is_spcs():
    return SNOWFLAKE_HOST is not None and os.path.exists(TOKEN_PATH)

def get_token():
    with open(TOKEN_PATH, 'r') as f:
        return f.read().strip()

def execute_sql_spcs(statement):
    token = get_token()
    resp = requests.post(
        f'https://{SNOWFLAKE_HOST}/api/v2/statements',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'X-Snowflake-Authorization-Token-Type': 'OAUTH',
        },
        json={
            'statement': statement,
            'warehouse': SNOWFLAKE_WAREHOUSE,
        },
        timeout=30,
    )
    data = resp.json()
    if 'message' in data and resp.status_code != 200:
        raise Exception(data['message'])
    col_names = [c['name'].lower() for c in data.get('resultSetMetaData', {}).get('rowType', [])]
    rows = data.get('data', [])
    return [dict(zip(col_names, row)) for row in rows]

def execute_sql_local(statement):
    import snowflake.connector
    conn = snowflake.connector.connect(connection_name=CONNECTION_NAME)
    try:
        cur = conn.cursor()
        cur.execute(statement)
        cols = [d[0].lower() for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()

def execute_sql(statement):
    if is_spcs():
        return execute_sql_spcs(statement)
    return execute_sql_local(statement)

def parse_extension(ext):
    if not ext:
        return []
    try:
        return json.loads(ext)
    except Exception:
        return []

def parse_json_array(val):
    if not val:
        return []
    try:
        return json.loads(val)
    except Exception:
        return []

@app.route('/api/views')
def list_views():
    rows = execute_sql('SHOW SEMANTIC VIEWS IN ACCOUNT')
    views = []
    for r in rows:
        created = r.get('created_on', '')
        if hasattr(created, 'isoformat'):
            created = created.isoformat()
        views.append({
            'name': r.get('name', ''),
            'database': r.get('database_name', ''),
            'schema': r.get('schema_name', ''),
            'comment': r.get('comment', '') or '',
            'owner': r.get('owner', '') or '',
            'ownerRoleType': r.get('owner_role_type', '') or '',
            'createdOn': str(created),
            'extension': parse_extension(r.get('extension')),
        })
    return jsonify(views)

@app.route('/api/views/<database>/<schema>/<name>')
def describe_view(database, schema, name):
    fqn = f'"{database}"."{schema}"."{name}"'
    rows = execute_sql(f'DESCRIBE SEMANTIC VIEW {fqn}')
    detail = parse_describe_rows(rows)
    return jsonify(detail)

def parse_describe_rows(rows):
    detail = {
        'comment': '',
        'tables': [],
        'dimensions': [],
        'facts': [],
        'metrics': [],
        'relationships': [],
        'verifiedQueries': [],
    }
    table_map = {}
    rel_map = {}
    dim_map = {}
    fact_map = {}
    metric_map = {}
    vq_map = {}

    for row in rows:
        kind = row.get('object_kind')
        obj_name = row.get('object_name')
        parent = row.get('parent_entity')
        prop = row.get('property', '')
        val = row.get('property_value', '')

        if not kind:
            if prop == 'COMMENT':
                detail['comment'] = val or ''
            continue

        if kind == 'EXTENSION':
            continue

        if kind == 'TABLE':
            key = obj_name
            if key not in table_map:
                table_map[key] = {'name': key, 'database': '', 'schema': '', 'baseTable': '', 'primaryKey': [], 'synonyms': [], 'comment': ''}
            t = table_map[key]
            if prop == 'BASE_TABLE_DATABASE_NAME': t['database'] = val
            elif prop == 'BASE_TABLE_SCHEMA_NAME': t['schema'] = val
            elif prop == 'BASE_TABLE_NAME': t['baseTable'] = val
            elif prop == 'PRIMARY_KEY': t['primaryKey'] = parse_json_array(val)
            elif prop == 'SYNONYMS': t['synonyms'] = parse_json_array(val)
            elif prop == 'COMMENT': t['comment'] = val or ''
            continue

        if kind == 'RELATIONSHIP':
            key = obj_name
            if key not in rel_map:
                rel_map[key] = {'name': key, 'table': '', 'refTable': '', 'foreignKey': [], 'refKey': []}
            r = rel_map[key]
            if prop == 'TABLE': r['table'] = val
            elif prop == 'REF_TABLE': r['refTable'] = val
            elif prop == 'FOREIGN_KEY': r['foreignKey'] = parse_json_array(val)
            elif prop == 'REF_KEY': r['refKey'] = parse_json_array(val)
            continue

        if kind == 'DIMENSION':
            key = f"{parent}::{obj_name}"
            if key not in dim_map:
                dim_map[key] = {'name': obj_name, 'table': parent or '', 'expression': '', 'dataType': '', 'synonyms': [], 'accessModifier': 'PUBLIC', 'comment': ''}
            d = dim_map[key]
            if prop == 'TABLE': d['table'] = val
            elif prop == 'EXPRESSION': d['expression'] = val
            elif prop == 'DATA_TYPE': d['dataType'] = val
            elif prop == 'SYNONYMS': d['synonyms'] = parse_json_array(val)
            elif prop == 'ACCESS_MODIFIER': d['accessModifier'] = val
            elif prop == 'COMMENT': d['comment'] = val or ''
            continue

        if kind == 'FACT':
            key = f"{parent}::{obj_name}"
            if key not in fact_map:
                fact_map[key] = {'name': obj_name, 'table': parent or '', 'expression': '', 'dataType': '', 'synonyms': [], 'accessModifier': 'PUBLIC', 'comment': ''}
            f = fact_map[key]
            if prop == 'TABLE': f['table'] = val
            elif prop == 'EXPRESSION': f['expression'] = val
            elif prop == 'DATA_TYPE': f['dataType'] = val
            elif prop == 'SYNONYMS': f['synonyms'] = parse_json_array(val)
            elif prop == 'ACCESS_MODIFIER': f['accessModifier'] = val
            elif prop == 'COMMENT': f['comment'] = val or ''
            continue

        if kind in ('METRIC', 'DERIVED_METRIC'):
            key = f"{parent}::{obj_name}"
            if key not in metric_map:
                metric_map[key] = {'name': obj_name, 'table': parent or '', 'expression': '', 'dataType': '', 'synonyms': [], 'accessModifier': 'PUBLIC', 'comment': ''}
            m = metric_map[key]
            if prop == 'TABLE': m['table'] = val
            elif prop == 'EXPRESSION': m['expression'] = val
            elif prop == 'DATA_TYPE': m['dataType'] = val
            elif prop == 'SYNONYMS': m['synonyms'] = parse_json_array(val)
            elif prop == 'ACCESS_MODIFIER': m['accessModifier'] = val
            elif prop == 'COMMENT': m['comment'] = val or ''
            continue

        if kind == 'AI_VERIFIED_QUERY':
            key = obj_name
            if key not in vq_map:
                vq_map[key] = {'name': key, 'question': '', 'sql': '', 'verifiedAt': '', 'verifiedBy': '', 'onboardingQuestion': False}
            q = vq_map[key]
            if prop == 'QUESTION': q['question'] = val
            elif prop == 'SQL': q['sql'] = val
            elif prop == 'VERIFIED_AT': q['verifiedAt'] = val
            elif prop == 'VERIFIED_BY': q['verifiedBy'] = val
            elif prop == 'ONBOARDING_QUESTION': q['onboardingQuestion'] = val in ('TRUE', 'true')
            continue

    detail['tables'] = list(table_map.values())
    detail['relationships'] = list(rel_map.values())
    detail['dimensions'] = list(dim_map.values())
    detail['facts'] = list(fact_map.values())
    detail['metrics'] = list(metric_map.values())
    detail['verifiedQueries'] = list(vq_map.values())
    return detail

if app.static_folder:
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 3001)), debug=not is_spcs())
