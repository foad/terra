import psycopg2
from aws_lambda_powertools.utilities import parameters

_connection = None


def get_database_url() -> str:
    return parameters.get_parameter("/terra/database_url", decrypt=True)


def get_connection():
    global _connection
    if _connection is None or _connection.closed:
        _connection = psycopg2.connect(get_database_url())
    return _connection
