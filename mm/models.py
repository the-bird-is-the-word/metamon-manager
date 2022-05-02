from mm import db


class Battle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.BigInteger, nullable=False)
    wallet = db.Column(db.String(42), nullable=False)
    metamon_id = db.Column(db.Integer, nullable=False)
    battles = db.Column(db.Integer, nullable=False)
    won = db.Column(db.Integer, nullable=False)
    fragments = db.Column(db.Integer, nullable=False)
    league_level = db.Column(db.Integer, nullable=False)
    metamon_level = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return f'<Battle {self.id}, {self.metamon_id}>'


class Metamon(db.Model):
    metamon_id = db.Column(db.Integer, primary_key=True)
    rarity = db.Column(db.String(3), nullable=False)
    power = db.Column(db.Integer, nullable=False)
    metamon_level = db.Column(db.Integer, nullable=False)
    experience = db.Column(db.Integer, nullable=False)
    league_level = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return f'<Metamon {self.metamon_id}>'


class DailyStats(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.BigInteger, nullable=False)
    minted_eggs = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return f'<Battle {self.id}, {self.timestamp}>'
