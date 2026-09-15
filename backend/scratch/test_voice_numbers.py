from app import create_app, db
from app.models.user import User
from app.models.device import Device
from app.models.repair_request import RepairRequest
from app.services.voice_service import VoiceService

app = create_app()

with app.app_context():
    print("--- TESTING VOICE NUMBER RECOGNITION & SELECTION ---")
    
    # 1. Test _normalize_spoken_numbers
    test_cases = [
        ("one two three", "123"),
        ("1 2 3", "123"),
        ("123", "123"),
        ("pwo", "2"),
        ("one two three four five six", "123456"),
        ("repair one two three", "repair 123"),
        ("job two", "job 2"),
        ("option 3", "option 3"),
        ("first", "1"),
        ("second", "2"),
        ("third", "3"),
    ]

    for raw, expected in test_cases:
        res = VoiceService._normalize_spoken_numbers(raw)
        assert res == expected, f"Failed for '{raw}': expected '{expected}', got '{res}'"
        print(f"✓ '{raw}' -> '{res}'")

    print("\n--- TESTING PROCESS_QUERY WITH CUSTOMER ---")
    user = User.query.filter_by(role="CUSTOMER").first()
    if not user:
        user = User(name="Voice Test Customer", email="voicetest@example.com", password_hash="dummy")
        db.session.add(user)
        db.session.commit()

    # Test process_query with 'one two three'
    res1 = VoiceService.process_query(user, "one two three")
    print(f"Input: 'one two three'\nResponse: {res1['response']}\nIntent: {res1['intent']}")
    assert res1['success'] is True

    # Test process_query with '1 2 3'
    res2 = VoiceService.process_query(user, "1 2 3")
    print(f"\nInput: '1 2 3'\nResponse: {res2['response']}\nIntent: {res2['intent']}")
    assert res2['success'] is True

    # Test process_query with selection context
    context = {"last_mentioned_repairs": [10, 20, 30], "pending_selection_intent": "GET_REPAIR_STATUS"}
    res3 = VoiceService.process_query(user, "two", context=context)
    print(f"\nInput: 'two' with selection context\nResponse: {res3['response']}\nIntent: {res3['intent']}")

    print("\n=== ALL VOICE NUMBER TESTS PASSED SUCCESSFULLY! ===")
