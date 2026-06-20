import psycopg2
from aws_lambda_powertools.utilities import parameters
from psycopg2.extensions import TRANSACTION_STATUS_INERROR

_connection = None


def get_database_url() -> str:
    return parameters.get_parameter("/terra/database_url", decrypt=True)


def get_connection():
    global _connection
    if _connection is None or _connection.closed:
        _connection = psycopg2.connect(get_database_url())
        _connection.autocommit = True
        return _connection
    if _connection.info.transaction_status == TRANSACTION_STATUS_INERROR:
        try:
            _connection.rollback()
        except psycopg2.Error:
            try:
                _connection.close()
            except psycopg2.Error:
                pass
            _connection = psycopg2.connect(get_database_url())
            _connection.autocommit = True
    return _connection
