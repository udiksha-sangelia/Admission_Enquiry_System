import json
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

DATA_FILE = Path(__file__).parent / "data" / "enquiries.json"


def ensure_data_file():
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if DATA_FILE.exists():
        return
    seed = [
        {
            "id": 1,
            "candidateName": "Rahul Patil",
            "fatherName": "Mahesh Patil",
            "motherName": "Sunita Patil",
            "fatherOccupation": "Farmer",
            "motherOccupation": "Homemaker",
            "contactNo": "9876543210",
            "alternateContactNo": "9988776655",
            "pucPercent": 86.5,
            "examType": "CET",
            "examRank": 1123,
            "hostelRequired": "Yes",
            "category": "GM",
            "interestedCourse1": "CSE",
            "interestedCourse2": "ECE",
            "pucCollegeNamePlace": "KLS PU College, Belagavi",
            "postalAddress": "Tilakwadi, Belagavi",
            "status": "Pending",
            "paymentStatus": "Unpaid",
            "paymentAmount": 0,
            "createdAt": "2026-04-19T10:30:00",
        },
        {
            "id": 2,
            "candidateName": "Sneha Kulkarni",
            "fatherName": "Ramesh Kulkarni",
            "motherName": "Anita Kulkarni",
            "fatherOccupation": "Teacher",
            "motherOccupation": "Teacher",
            "contactNo": "9123456780",
            "alternateContactNo": "9345678901",
            "pucPercent": 91.2,
            "examType": "COMEDK",
            "examRank": 2478,
            "hostelRequired": "No",
            "category": "OBC",
            "interestedCourse1": "ECE",
            "interestedCourse2": "CSE",
            "pucCollegeNamePlace": "RLS PU College, Belagavi",
            "postalAddress": "Shahapur, Belagavi",
            "status": "Pending",
            "paymentStatus": "Paid",
            "paymentAmount": 5000,
            "createdAt": "2026-04-20T12:15:00",
        },
    ]
    DATA_FILE.write_text(json.dumps(seed, indent=2), encoding="utf-8")


def load_enquiries():
    ensure_data_file()
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def save_enquiries(enquiries):
    DATA_FILE.write_text(json.dumps(enquiries, indent=2), encoding="utf-8")


def currency(amount):
    return f"₹ {amount:,.0f}"


def dashboard_payload():
    enquiries = sorted(load_enquiries(), key=lambda item: item["id"], reverse=True)
    total = len(enquiries)
    paid = sum(1 for item in enquiries if item.get("paymentStatus") == "Paid")
    pending = sum(1 for item in enquiries if item.get("status") == "Pending")
    new_today = sum(
        1
        for item in enquiries
        if item.get("createdAt", "")[:10] == datetime.now().strftime("%Y-%m-%d")
    )
    total_advance = sum(float(item.get("paymentAmount", 0)) for item in enquiries)
    pending_amount = max(total * 5000 - total_advance, 0)
    hostel_yes = sum(1 for item in enquiries if item.get("hostelRequired") == "Yes")
    hostel_no = total - hostel_yes

    category_counts = {}
    for item in enquiries:
        category = item.get("category", "Other")
        category_counts[category] = category_counts.get(category, 0) + 1

    top_categories = [
        {"name": name, "value": f"{count} ({(count / total * 100):.1f}%)" if total else "0"}
        for name, count in sorted(category_counts.items(), key=lambda pair: pair[1], reverse=True)
    ]

    applications = [
        {
            "id": item["id"],
            "name": item["candidateName"],
            "contact": item["contactNo"],
            "course": item["interestedCourse1"],
            "exam": item["examType"],
            "status": item.get("status", "Pending"),
            "paymentStatus": item.get("paymentStatus", "Unpaid"),
        }
        for item in enquiries[:10]
    ]

    return {
        "kpis": [
            {
                "label": "Total Applications",
                "value": str(total),
                "subLabel": "All Time",
                "accent": "blue",
            },
            {
                "label": "New Applications",
                "value": str(new_today),
                "subLabel": "Today",
                "accent": "green",
            },
            {
                "label": "Pending Applications",
                "value": str(pending),
                "subLabel": "Pending",
                "accent": "amber",
            },
            {
                "label": "Payments Completed",
                "value": str(paid),
                "subLabel": "Fee Entries",
                "accent": "violet",
            },
        ],
        "applications": applications,
        "paymentOverview": {
            "advanceCollected": currency(total_advance),
            "pendingAmount": currency(pending_amount),
        },
        "topCategories": top_categories,
        "hostelRequirement": {
            "yes": f"{hostel_yes} ({(hostel_yes / total * 100):.1f}%)" if total else "0",
            "no": f"{hostel_no} ({(hostel_no / total * 100):.1f}%)" if total else "0",
            "total": total,
        },
    }


@app.get("/api/dashboard")
def get_dashboard():
    return jsonify(dashboard_payload())


@app.post("/api/enquiries")
def create_enquiry():
    payload = request.get_json(force=True)
    required = [
        "candidateName",
        "fatherName",
        "motherName",
        "contactNo",
        "pucPercent",
        "examType",
        "category",
        "interestedCourse1",
        "pucCollegeNamePlace",
        "postalAddress",
    ]
    missing = [field for field in required if not str(payload.get(field, "")).strip()]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    enquiries = load_enquiries()
    next_id = max((item["id"] for item in enquiries), default=0) + 1
    enquiry = {
        "id": next_id,
        "candidateName": payload["candidateName"].strip(),
        "fatherName": payload["fatherName"].strip(),
        "motherName": payload["motherName"].strip(),
        "fatherOccupation": payload.get("fatherOccupation", "").strip(),
        "motherOccupation": payload.get("motherOccupation", "").strip(),
        "contactNo": payload["contactNo"].strip(),
        "alternateContactNo": payload.get("alternateContactNo", "").strip(),
        "pucPercent": float(payload["pucPercent"]),
        "examType": payload["examType"].strip(),
        "examRank": payload.get("examRank", "").strip(),
        "hostelRequired": payload.get("hostelRequired", "No").strip(),
        "category": payload["category"].strip(),
        "interestedCourse1": payload["interestedCourse1"].strip(),
        "interestedCourse2": payload.get("interestedCourse2", "").strip(),
        "pucCollegeNamePlace": payload["pucCollegeNamePlace"].strip(),
        "postalAddress": payload["postalAddress"].strip(),
        "status": "Pending",
        "paymentStatus": "Unpaid",
        "paymentAmount": 0,
        "createdAt": datetime.now().isoformat(timespec="seconds"),
    }
    enquiries.append(enquiry)
    save_enquiries(enquiries)
    return jsonify({"message": "Enquiry created", "id": next_id}), 201


@app.post("/api/enquiries/<int:enquiry_id>/payment")
def record_payment(enquiry_id):
    payload = request.get_json(force=True)
    amount = float(payload.get("amount", 0))
    if amount <= 0:
        return jsonify({"error": "Payment amount must be greater than zero."}), 400

    enquiries = load_enquiries()
    enquiry = next((item for item in enquiries if item["id"] == enquiry_id), None)
    if not enquiry:
        return jsonify({"error": "Enquiry not found"}), 404

    enquiry["paymentAmount"] = float(enquiry.get("paymentAmount", 0)) + amount
    enquiry["paymentStatus"] = "Paid"
    save_enquiries(enquiries)
    return jsonify({"message": "Payment recorded"})


if __name__ == "__main__":
    app.run(debug=True)
