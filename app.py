from flask import Flask, render_template, send_from_directory, jsonify
import os

app = Flask(__name__)

# 音楽ファイルと譜面データを配信するためのルートを設定
@app.route('/')
def index():
    # templates/index.html をレンダリングして返す
    return render_template('index.html')

@app.route('/audio/<filename>')
def serve_audio(filename):
    # static/audio フォルダから音楽ファイルを配信
    return send_from_directory(os.path.join(app.root_path, 'static', 'audio'), filename)

@app.route('/api/chart/<difficulty>')
def get_chart(difficulty):
    # 例として、ここに譜面データを定義します。
    # 実際はJSONファイルから読み込むことが多いでしょう。
    chart_data = {
        "song_title": "サンプル楽曲",
        "artist": "あなた",
        "bpm": 120,
        "offset": 0.0,
        "difficulties": {
            "normal": {
                "level": 5,
                "notes": [
                    {"time": 2.000, "lane": 2, "type": "tap"},
                    {"time": 2.500, "lane": 4, "type": "tap"},
                    {"time": 3.000, "lane": 1, "type": "tap"},
                    {"time": 3.500, "lane": 3, "type": "long", "duration": 1.0},
                    {"time": 5.000, "lane": 5, "type": "tap"},
                    {"time": 5.500, "lane": 2, "type": "flick", "direction": "right"},
                    {"time": 6.000, "lane": 3, "type": "tap"},
                    {"time": 6.500, "lane": 1, "type": "tap"}
                    # もっとノーツを追加できます
                ]
            }
        }
    }
    
    # リクエストされた難易度の譜面データをJSONとして返す
    selected_difficulty_chart = chart_data['difficulties'].get(difficulty)
    if selected_difficulty_chart:
        return jsonify(selected_difficulty_chart)
    else:
        return jsonify({"error": "Difficulty not found"}), 404

if __name__ == '__main__':
    # デバッグモードでアプリケーションを実行（開発中はTrueでOK）
    app.run(debug=True)
