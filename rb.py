from app import app, db, VocabularyItem

with app.app_context():
    items = VocabularyItem.query.all()
    for item in items:
        if not hasattr(item, 'explanation') or item.explanation is None:
            item.explanation = ""
    db.session.commit()