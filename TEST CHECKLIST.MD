MVP Pre-Launch Checklist
🔴 Critical — Must Verify Before Go-Live
#	Item	How to Test	Status
1	Thread create → CT mint	Create new thread, wallet prompts show "Nullify Thread CT"	⏳
2	Thread create → DT mint (holder)	Wallet prompt shows "Authorize my own access to the new Nullify Thread"	⏳
3	Invite → DT mint (guest)	Wallet prompt shows "Authorize an invitation to the new Nullify Thread"	⏳
4	Thread burn	Burn thread, verify on-chain tx, thread becomes inaccessible	⏳
5	Helper cache store/fetch	Messages persist across page refresh via helper cache	⏳
6	Overlay relay connection	Status shows "online", messages deliver in real-time	⏳
7	Invite link generation	Generate invite, share link, guest can accept	⏳
8	Guest join flow	Guest accepts invite, sees thread, can send messages	⏳
9	Wallet backup/restore	Create backup, clear storage, restore from backup	⏳
🟡 Important — Should Verify
#	Item	Notes
10	PeerPay auto-accept	Incoming payments auto-accept if enabled
11	Donation fee flow	If donation identity key set, fee outputs work
12	Profile card creation	User can set display name, persists
13	Theme persistence	Dark/light mode persists across sessions
14	Welcome/onboarding flow	First-time users see welcome page
🟢 Nice to Have — Can Fix Post-Launch
#	Item	Notes
15	Typing indicators	Optional feature
16	Read receipts	Optional feature
17	Contact management	Can add/remove contacts
