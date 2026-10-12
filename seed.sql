INSERT INTO proposals (id, title, summary, category, priority, status, department, owner_id, owner_email, progress, due_date, demo_data)
VALUES
('demo-001','Digital Evidence Capture Pilot','Pilot secure evidence-capture tablets for patrol teams with chain-of-custody controls and supervisor review.','Technology','High','Approved','Technology & Modernisation','demo-system','demo@ipmprs.example',0,'2026-12-15',TRUE),
('demo-002','Station Visitor Management Upgrade','Introduce a standard visitor register, printable visitor passes and daily supervisory reconciliation at selected stations.','Infrastructure','Medium','Under Review','Station Administration','demo-system','demo@ipmprs.example',0,'2026-11-30',TRUE),
('demo-003','Community Cyber Awareness Programme','Run a phased cyber-safety awareness programme in schools and community centres with attendance and outcome reporting.','Training','Medium','Recommended','Community Policing','demo-system','demo@ipmprs.example',0,'2027-01-31',TRUE),
('demo-004','Emergency Communications Backup','Assess resilient backup communications for field units during network outages, including procurement and maintenance estimates.','Equipment','Critical','Submitted','Communications','demo-system','demo@ipmprs.example',0,'2026-11-20',TRUE),
('demo-005','Records Digitisation Phase I','Digitise selected administrative records with retention schedules, access controls and quality-assurance sampling.','Digital Transformation','Low','Closed','Records Management','demo-system','demo@ipmprs.example',100,'2026-09-15',TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO proposal_audit (id, proposal_id, actor_id, actor_email, action, from_status, to_status, reason, created_at)
VALUES
('demo-audit-001','demo-001','demo-system','demo@ipmprs.example','Proposal approved','Recommended','Approved','Illustrative demo approval; no real decision was made.',NOW() - INTERVAL '4 days'),
('demo-audit-002','demo-002','demo-system','demo@ipmprs.example','Proposal submitted','Draft','Submitted','Illustrative sample workflow event.',NOW() - INTERVAL '2 days'),
('demo-audit-003','demo-003','demo-system','demo@ipmprs.example','Review recommendation recorded','Under Review','Recommended','Illustrative sample workflow event.',NOW() - INTERVAL '1 day'),
('demo-audit-004','demo-004','demo-system','demo@ipmprs.example','Proposal submitted','Draft','Submitted','Illustrative sample workflow event.',NOW() - INTERVAL '10 hours'),
('demo-audit-005','demo-005','demo-system','demo@ipmprs.example','Implementation completed','Implementing','Closed','Illustrative sample closure event.',NOW() - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;