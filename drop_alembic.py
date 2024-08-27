import sqlite3
import os

# 데이터베이스 파일 경로
db_path = 'instance/users.db'

# 데이터베이스가 존재하는지 확인
if not os.path.exists(db_path):
    print("데이터베이스 파일이 존재하지 않습니다.")
    exit()

# 데이터베이스 연결
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 'alembic_version' 테이블 삭제
    cursor.execute("DROP TABLE IF EXISTS alembic_version")
    print("'alembic_version' 테이블이 삭제되었습니다.")

    # 'report' 테이블 삭제
    cursor.execute("DROP TABLE IF EXISTS report")
    print("'report' 테이블이 삭제되었습니다.")

    # 변경사항 저장
    conn.commit()
    print("변경사항이 성공적으로 저장되었습니다.")

except sqlite3.Error as e:
    print(f"오류 발생: {e}")

finally:
    # 연결 종료
    conn.close()

print("데이터베이스 정리가 완료되었습니다.")