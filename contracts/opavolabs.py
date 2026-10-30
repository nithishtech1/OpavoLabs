# OpavoLabs: lab equipment checkout with photo-hash evidence and deposits.
# SmartPy current syntax (@sp.module, package smartpy-tezos 0.24+).
# Interface is frozen in INTERFACE.md. Do not rename params without team agreement.
import smartpy as sp


@sp.module
def main():
    t_equipment: type = sp.record(
        name=sp.string,
        deposit=sp.mutez,
        status=sp.string,
        current_loan=sp.option[sp.nat],
    )

    t_loan: type = sp.record(
        equipment_id=sp.nat,
        student=sp.address,
        deposit=sp.mutez,
        checkout_cid=sp.string,
        checkout_hash=sp.bytes,
        return_cid=sp.option[sp.string],
        return_hash=sp.option[sp.bytes],
        status=sp.string,
        penalty=sp.mutez,
        requested_at=sp.timestamp,
        closed_at=sp.option[sp.timestamp],
    )

    class OpavoLabs(sp.Contract):
        def __init__(self, admin):
            self.data.admin = admin
            self.data.next_equipment_id = sp.nat(0)
            self.data.next_loan_id = sp.nat(0)
            self.data.equipment = sp.cast(sp.big_map(), sp.big_map[sp.nat, t_equipment])
            self.data.loans = sp.cast(sp.big_map(), sp.big_map[sp.nat, t_loan])

        # 1. Admin registers a new item.
        @sp.entrypoint
        def register_equipment(self, params):
            sp.cast(params, sp.record(name=sp.string, deposit=sp.mutez))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert sp.amount == sp.mutez(0), "NO_TEZ_EXPECTED"
            assert sp.len(params.name) > 0, "EMPTY_NAME"
            self.data.equipment[self.data.next_equipment_id] = sp.record(
                name=params.name,
                deposit=params.deposit,
                status="AVAILABLE",
                current_loan=sp.cast(None, sp.option[sp.nat]),
            )
            self.data.next_equipment_id += 1

        # 2. Student requests checkout; the deposit travels WITH this call.
        @sp.entrypoint
        def request_checkout(self, params):
            sp.cast(params, sp.record(
                equipment_id=sp.nat, photo_cid=sp.string, photo_hash=sp.bytes))
            assert sp.sender != self.data.admin, "ADMIN_CANNOT_BORROW"
            assert self.data.equipment.contains(params.equipment_id), "NO_SUCH_EQUIPMENT"
            eq = self.data.equipment[params.equipment_id]
            assert eq.status == "AVAILABLE", "NOT_AVAILABLE"
            assert sp.amount == eq.deposit, "WRONG_DEPOSIT"
            assert sp.len(params.photo_hash) == 32, "BAD_HASH"
            assert sp.len(params.photo_cid) > 0, "EMPTY_CID"
            loan_id = self.data.next_loan_id
            self.data.loans[loan_id] = sp.record(
                equipment_id=params.equipment_id,
                student=sp.sender,
                deposit=sp.amount,
                checkout_cid=params.photo_cid,
                checkout_hash=params.photo_hash,
                return_cid=sp.cast(None, sp.option[sp.string]),
                return_hash=sp.cast(None, sp.option[sp.bytes]),
                status="CHECKOUT_PENDING",
                penalty=sp.mutez(0),
                requested_at=sp.now,
                closed_at=sp.cast(None, sp.option[sp.timestamp]),
            )
            self.data.equipment[params.equipment_id].status = "RESERVED"
            self.data.equipment[params.equipment_id].current_loan = sp.Some(loan_id)
            self.data.next_loan_id += 1

        # 3. Admin confirms the loan; seen_hash proves they saw the same photo.
        @sp.entrypoint
        def approve_checkout(self, params):
            sp.cast(params, sp.record(loan_id=sp.nat, seen_hash=sp.bytes))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert self.data.loans.contains(params.loan_id), "NO_SUCH_LOAN"
            loan = self.data.loans[params.loan_id]
            assert loan.status == "CHECKOUT_PENDING", "BAD_LOAN_STATE"
            assert params.seen_hash == loan.checkout_hash, "HASH_MISMATCH"
            self.data.loans[params.loan_id].status = "ACTIVE"
            self.data.equipment[loan.equipment_id].status = "CHECKED_OUT"

        # 4. Admin rejects; full refund. Release point 1 of 3.
        @sp.entrypoint
        def reject_checkout(self, loan_id):
            sp.cast(loan_id, sp.nat)
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert self.data.loans.contains(loan_id), "NO_SUCH_LOAN"
            loan = self.data.loans[loan_id]
            assert loan.status == "CHECKOUT_PENDING", "BAD_LOAN_STATE"
            # state first, money last
            self.data.loans[loan_id].status = "REJECTED"
            self.data.loans[loan_id].closed_at = sp.Some(sp.now)
            self.data.equipment[loan.equipment_id].status = "AVAILABLE"
            self.data.equipment[loan.equipment_id].current_loan = sp.cast(None, sp.option[sp.nat])
            sp.send(loan.student, loan.deposit)

        # 5. Student cancels own pending request; full refund. Release point 2 of 3.
        @sp.entrypoint
        def cancel_request(self, loan_id):
            sp.cast(loan_id, sp.nat)
            assert self.data.loans.contains(loan_id), "NO_SUCH_LOAN"
            loan = self.data.loans[loan_id]
            assert sp.sender == loan.student, "NOT_BORROWER"
            assert loan.status == "CHECKOUT_PENDING", "BAD_LOAN_STATE"
            self.data.loans[loan_id].status = "CANCELLED"
            self.data.loans[loan_id].closed_at = sp.Some(sp.now)
            self.data.equipment[loan.equipment_id].status = "AVAILABLE"
            self.data.equipment[loan.equipment_id].current_loan = sp.cast(None, sp.option[sp.nat])
            sp.send(loan.student, loan.deposit)

        # 6. Student submits return photo.
        @sp.entrypoint
        def request_return(self, params):
            sp.cast(params, sp.record(
                loan_id=sp.nat, photo_cid=sp.string, photo_hash=sp.bytes))
            assert self.data.loans.contains(params.loan_id), "NO_SUCH_LOAN"
            loan = self.data.loans[params.loan_id]
            assert sp.sender == loan.student, "NOT_BORROWER"
            assert loan.status == "ACTIVE", "BAD_LOAN_STATE"
            assert sp.len(params.photo_hash) == 32, "BAD_HASH"
            assert sp.len(params.photo_cid) > 0, "EMPTY_CID"
            self.data.loans[params.loan_id].return_cid = sp.Some(params.photo_cid)
            self.data.loans[params.loan_id].return_hash = sp.Some(params.photo_hash)
            self.data.loans[params.loan_id].status = "RETURN_PENDING"
            self.data.equipment[loan.equipment_id].status = "RETURN_PENDING"

        # 7. Admin approves return, splits deposit. Release point 3 of 3.
        @sp.entrypoint
        def approve_return(self, params):
            sp.cast(params, sp.record(
                loan_id=sp.nat, seen_hash=sp.bytes, penalty=sp.mutez))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert self.data.loans.contains(params.loan_id), "NO_SUCH_LOAN"
            loan = self.data.loans[params.loan_id]
            assert loan.status == "RETURN_PENDING", "BAD_LOAN_STATE"
            assert loan.return_hash == sp.Some(params.seen_hash), "HASH_MISMATCH"
            assert params.penalty <= loan.deposit, "PENALTY_TOO_HIGH"
            # state changes FIRST: loan is CLOSED before any money moves,
            # so the deposit can never be released twice.
            self.data.loans[params.loan_id].status = "CLOSED"
            self.data.loans[params.loan_id].penalty = params.penalty
            self.data.loans[params.loan_id].closed_at = sp.Some(sp.now)
            self.data.equipment[loan.equipment_id].status = "AVAILABLE"
            self.data.equipment[loan.equipment_id].current_loan = sp.cast(None, sp.option[sp.nat])
            refund = loan.deposit - params.penalty
            if params.penalty > sp.mutez(0):
                sp.send(self.data.admin, params.penalty)
            if refund > sp.mutez(0):
                sp.send(loan.student, refund)

        # 8. [P1] Admin sends return back; student can submit a new photo.
        @sp.entrypoint
        def reject_return(self, loan_id):
            sp.cast(loan_id, sp.nat)
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert self.data.loans.contains(loan_id), "NO_SUCH_LOAN"
            loan = self.data.loans[loan_id]
            assert loan.status == "RETURN_PENDING", "BAD_LOAN_STATE"
            self.data.loans[loan_id].status = "ACTIVE"
            self.data.equipment[loan.equipment_id].status = "CHECKED_OUT"


# ---------------------------------------------------------------- tests
H1 = sp.bytes("0x" + "ab" * 32)      # checkout photo hash
H2 = sp.bytes("0x" + "cd" * 32)      # return photo hash
HBAD = sp.bytes("0x" + "ef" * 32)    # a different, valid-length hash
H31 = sp.bytes("0x" + "ab" * 31)     # wrong length


def setup(name):
    sc = sp.test_scenario(name, main)
    admin = sp.test_account("admin")
    a = sp.test_account("studentA")
    b = sp.test_account("studentB")
    c = main.OpavoLabs(admin.address)
    sc += c
    c.register_equipment(name="LiDAR", deposit=sp.tez(5), _sender=admin)
    return sc, c, admin, a, b


def to_active(sc, c, admin, a):
    c.request_checkout(equipment_id=0, photo_cid="bafyCheckout", photo_hash=H1,
                       _sender=a, _amount=sp.tez(5))
    c.approve_checkout(loan_id=0, seen_hash=H1, _sender=admin)


def to_return_pending(sc, c, admin, a):
    to_active(sc, c, admin, a)
    c.request_return(loan_id=0, photo_cid="bafyReturn", photo_hash=H2, _sender=a)


@sp.add_test()
def test_happy_no_penalty():
    sc, c, admin, a, b = setup("happy_no_penalty")
    sc.verify(c.data.equipment[0].status == "AVAILABLE")
    c.request_checkout(equipment_id=0, photo_cid="bafyCheckout", photo_hash=H1,
                       _sender=a, _amount=sp.tez(5))
    sc.verify(c.balance == sp.tez(5))                       # conservation: 1 live loan
    sc.verify(c.data.equipment[0].status == "RESERVED")
    c.approve_checkout(loan_id=0, seen_hash=H1, _sender=admin)
    sc.verify(c.data.equipment[0].status == "CHECKED_OUT")
    sc.verify(c.data.loans[0].status == "ACTIVE")
    c.request_return(loan_id=0, photo_cid="bafyReturn", photo_hash=H2, _sender=a)
    sc.verify(c.data.equipment[0].status == "RETURN_PENDING")
    c.approve_return(loan_id=0, seen_hash=H2, penalty=sp.tez(0), _sender=admin)
    sc.verify(c.data.loans[0].status == "CLOSED")
    sc.verify(c.data.equipment[0].status == "AVAILABLE")
    sc.verify(c.balance == sp.tez(0))                       # all deposit left the contract


@sp.add_test()
def test_happy_with_penalty():
    sc, c, admin, a, b = setup("happy_with_penalty")
    to_return_pending(sc, c, admin, a)
    c.approve_return(loan_id=0, seen_hash=H2, penalty=sp.tez(2), _sender=admin)
    sc.verify(c.data.loans[0].penalty == sp.tez(2))
    sc.verify(c.balance == sp.tez(0))                       # 2 -> admin, 3 -> student
    # Per-recipient amounts (admin +2, student +3) are checked in the live test (3.4):
    # SmartPy test accounts do not expose balances. Check TzKT / Temple there.


@sp.add_test()
def test_reject_and_cancel_refund():
    sc, c, admin, a, b = setup("reject_and_cancel")
    c.request_checkout(equipment_id=0, photo_cid="x", photo_hash=H1,
                       _sender=a, _amount=sp.tez(5))
    c.reject_checkout(0, _sender=admin)
    sc.verify(c.data.loans[0].status == "REJECTED")
    sc.verify(c.data.equipment[0].status == "AVAILABLE")
    sc.verify(c.balance == sp.tez(0))
    c.request_checkout(equipment_id=0, photo_cid="y", photo_hash=H1,
                       _sender=b, _amount=sp.tez(5))
    c.cancel_request(1, _sender=b)
    sc.verify(c.data.loans[1].status == "CANCELLED")
    sc.verify(c.data.equipment[0].status == "AVAILABLE")
    sc.verify(c.balance == sp.tez(0))


@sp.add_test()
def test_reject_return_then_return_again():
    sc, c, admin, a, b = setup("reject_return")
    to_return_pending(sc, c, admin, a)
    c.reject_return(0, _sender=admin)
    sc.verify(c.data.loans[0].status == "ACTIVE")
    sc.verify(c.data.equipment[0].status == "CHECKED_OUT")
    sc.verify(c.balance == sp.tez(5))                       # no money moved
    c.request_return(loan_id=0, photo_cid="bafyReturn2", photo_hash=H2, _sender=a)
    c.approve_return(loan_id=0, seen_hash=H2, penalty=sp.tez(0), _sender=admin)
    sc.verify(c.balance == sp.tez(0))


@sp.add_test()
def test_register_rules():
    sc, c, admin, a, b = setup("register_rules")
    c.register_equipment(name="Drone", deposit=sp.tez(3), _sender=a,
                         _valid=False, _exception="NOT_ADMIN")
    c.register_equipment(name="", deposit=sp.tez(3), _sender=admin,
                         _valid=False, _exception="EMPTY_NAME")
    c.register_equipment(name="Drone", deposit=sp.tez(3), _sender=admin,
                         _amount=sp.tez(1), _valid=False, _exception="NO_TEZ_EXPECTED")


@sp.add_test()
def test_request_rejections():
    sc, c, admin, a, b = setup("request_rejections")
    # wrong deposit: too low, too high, zero
    for amt in [sp.tez(4), sp.tez(6), sp.tez(0)]:
        c.request_checkout(equipment_id=0, photo_cid="x", photo_hash=H1, _sender=a,
                           _amount=amt, _valid=False, _exception="WRONG_DEPOSIT")
    c.request_checkout(equipment_id=0, photo_cid="x", photo_hash=H31, _sender=a,
                       _amount=sp.tez(5), _valid=False, _exception="BAD_HASH")
    c.request_checkout(equipment_id=0, photo_cid="", photo_hash=H1, _sender=a,
                       _amount=sp.tez(5), _valid=False, _exception="EMPTY_CID")
    c.request_checkout(equipment_id=0, photo_cid="x", photo_hash=H1, _sender=admin,
                       _amount=sp.tez(5), _valid=False, _exception="ADMIN_CANNOT_BORROW")
    c.request_checkout(equipment_id=9, photo_cid="x", photo_hash=H1, _sender=a,
                       _amount=sp.tez(5), _valid=False, _exception="NO_SUCH_EQUIPMENT")
    sc.verify(c.balance == sp.tez(0))


@sp.add_test()
def test_double_checkout():
    sc, c, admin, a, b = setup("double_checkout")
    c.request_checkout(equipment_id=0, photo_cid="x", photo_hash=H1,
                       _sender=a, _amount=sp.tez(5))
    # RESERVED
    c.request_checkout(equipment_id=0, photo_cid="y", photo_hash=H1, _sender=b,
                       _amount=sp.tez(5), _valid=False, _exception="NOT_AVAILABLE")
    c.approve_checkout(loan_id=0, seen_hash=H1, _sender=admin)
    # CHECKED_OUT
    c.request_checkout(equipment_id=0, photo_cid="y", photo_hash=H1, _sender=b,
                       _amount=sp.tez(5), _valid=False, _exception="NOT_AVAILABLE")
    sc.verify(c.balance == sp.tez(5))


@sp.add_test()
def test_wrong_approver_and_state_errors():
    sc, c, admin, a, b = setup("approver_and_state")
    c.request_checkout(equipment_id=0, photo_cid="x", photo_hash=H1,
                       _sender=a, _amount=sp.tez(5))
    c.approve_checkout(loan_id=0, seen_hash=H1, _sender=a,
                       _valid=False, _exception="NOT_ADMIN")
    c.reject_checkout(0, _sender=a, _valid=False, _exception="NOT_ADMIN")
    c.approve_checkout(loan_id=0, seen_hash=HBAD, _sender=admin,
                       _valid=False, _exception="HASH_MISMATCH")
    c.request_return(loan_id=0, photo_cid="r", photo_hash=H2, _sender=a,
                     _valid=False, _exception="BAD_LOAN_STATE")      # return before approval
    c.cancel_request(0, _sender=b, _valid=False, _exception="NOT_BORROWER")
    c.approve_checkout(loan_id=0, seen_hash=H1, _sender=admin)
    c.approve_checkout(loan_id=0, seen_hash=H1, _sender=admin,
                       _valid=False, _exception="BAD_LOAN_STATE")    # twice
    c.approve_checkout(loan_id=5, seen_hash=H1, _sender=admin,
                       _valid=False, _exception="NO_SUCH_LOAN")


@sp.add_test()
def test_approve_after_cancel():
    sc, c, admin, a, b = setup("approve_after_cancel")
    c.request_checkout(equipment_id=0, photo_cid="x", photo_hash=H1,
                       _sender=a, _amount=sp.tez(5))
    c.cancel_request(0, _sender=a)
    c.approve_checkout(loan_id=0, seen_hash=H1, _sender=admin,
                       _valid=False, _exception="BAD_LOAN_STATE")


@sp.add_test()
def test_return_rules_and_exactly_once():
    sc, c, admin, a, b = setup("return_rules")
    to_active(sc, c, admin, a)
    c.request_return(loan_id=0, photo_cid="r", photo_hash=H2, _sender=b,
                     _valid=False, _exception="NOT_BORROWER")
    c.request_return(loan_id=0, photo_cid="r", photo_hash=H31, _sender=a,
                     _valid=False, _exception="BAD_HASH")
    c.request_return(loan_id=0, photo_cid="r", photo_hash=H2, _sender=a)
    c.approve_return(loan_id=0, seen_hash=HBAD, penalty=sp.tez(0), _sender=admin,
                     _valid=False, _exception="HASH_MISMATCH")
    c.approve_return(loan_id=0, seen_hash=H2, penalty=sp.tez(6), _sender=admin,
                     _valid=False, _exception="PENALTY_TOO_HIGH")
    c.approve_return(loan_id=0, seen_hash=H2, penalty=sp.tez(1), _sender=a,
                     _valid=False, _exception="NOT_ADMIN")
    c.approve_return(loan_id=0, seen_hash=H2, penalty=sp.tez(1), _sender=admin)
    sc.verify(c.balance == sp.tez(0))
    # exactly once: second approval fails and nothing moves again
    c.approve_return(loan_id=0, seen_hash=H2, penalty=sp.tez(1), _sender=admin,
                     _valid=False, _exception="BAD_LOAN_STATE")
    c.cancel_request(0, _sender=a, _valid=False, _exception="BAD_LOAN_STATE")
    c.reject_checkout(0, _sender=admin, _valid=False, _exception="BAD_LOAN_STATE")
    sc.verify(c.balance == sp.tez(0))
