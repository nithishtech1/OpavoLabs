import smartpy as sp


@sp.module
def opavolabs():
    class OpavoLabs(sp.Contract):
        def __init__(self, admin):
            self.data.admin = admin
            self.data.next_equipment_id = 0
            self.data.next_loan_id = 0
            self.data.equipment = sp.cast(
                sp.big_map(), sp.big_map[sp.nat, sp.record(
                    name=sp.string,
                    deposit=sp.mutez,
                    status=sp.string,
                    current_loan=sp.option[sp.nat],
                )]
            )
            self.data.loans = sp.cast(
                sp.big_map(), sp.big_map[sp.nat, sp.record(
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
                )]
            )

        @sp.entrypoint
        def register_equipment(self, name, deposit):
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert sp.amount == sp.mutez(0), "NO_TEZ_EXPECTED"
            assert name != "", "EMPTY_NAME"

            equipment_id = self.data.next_equipment_id
            self.data.equipment[equipment_id] = sp.record(
                name=name,
                deposit=deposit,
                status="AVAILABLE",
                current_loan=None,
            )
            self.data.next_equipment_id += 1

        @sp.entrypoint
        def request_checkout(self, equipment_id, photo_cid, photo_hash):
            assert sp.sender != self.data.admin, "ADMIN_CANNOT_BORROW"
            assert self.data.equipment.contains(equipment_id), "NO_SUCH_EQUIPMENT"

            item = self.data.equipment[equipment_id]
            assert item.status == "AVAILABLE", "NOT_AVAILABLE"
            assert sp.amount == item.deposit, "WRONG_DEPOSIT"
            assert photo_cid != "", "EMPTY_CID"
            assert sp.len(photo_hash) == 32, "BAD_HASH"

            loan_id = self.data.next_loan_id
            self.data.loans[loan_id] = sp.record(
                equipment_id=equipment_id,
                student=sp.sender,
                deposit=sp.amount,
                checkout_cid=photo_cid,
                checkout_hash=photo_hash,
                return_cid=None,
                return_hash=None,
                status="CHECKOUT_PENDING",
                penalty=sp.mutez(0),
                requested_at=sp.now,
                closed_at=None,
            )
            self.data.equipment[equipment_id].status = "RESERVED"
            self.data.equipment[equipment_id].current_loan = sp.Some(loan_id)
            self.data.next_loan_id += 1

        @sp.entrypoint
        def approve_checkout(self, loan_id, seen_hash):
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert self.data.loans.contains(loan_id), "NO_SUCH_LOAN"

            loan = self.data.loans[loan_id]
            assert loan.status == "CHECKOUT_PENDING", "BAD_LOAN_STATE"
            assert seen_hash == loan.checkout_hash, "HASH_MISMATCH"

            self.data.loans[loan_id].status = "ACTIVE"
            self.data.equipment[loan.equipment_id].status = "CHECKED_OUT"

        @sp.entrypoint
        def request_return(self, loan_id, photo_cid, photo_hash):
            assert self.data.loans.contains(loan_id), "NO_SUCH_LOAN"

            loan = self.data.loans[loan_id]
            assert sp.sender == loan.student, "NOT_BORROWER"
            assert loan.status == "ACTIVE", "BAD_LOAN_STATE"
            assert photo_cid != "", "EMPTY_CID"
            assert sp.len(photo_hash) == 32, "BAD_HASH"

            self.data.loans[loan_id].return_cid = sp.Some(photo_cid)
            self.data.loans[loan_id].return_hash = sp.Some(photo_hash)
            self.data.loans[loan_id].status = "RETURN_PENDING"
            self.data.equipment[loan.equipment_id].status = "RETURN_PENDING"

        @sp.entrypoint
        def approve_return(self, loan_id, seen_hash, penalty):
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert self.data.loans.contains(loan_id), "NO_SUCH_LOAN"

            loan = self.data.loans[loan_id]
            assert loan.status == "RETURN_PENDING", "BAD_LOAN_STATE"
            assert loan.return_hash.is_some(), "BAD_LOAN_STATE"
            assert seen_hash == loan.return_hash.unwrap_some(), "HASH_MISMATCH"
            assert penalty <= loan.deposit, "PENALTY_TOO_HIGH"

            # Mark the loan terminal and release the equipment before transfers.
            self.data.loans[loan_id].status = "CLOSED"
            self.data.loans[loan_id].penalty = penalty
            self.data.loans[loan_id].closed_at = sp.Some(sp.now)
            self.data.equipment[loan.equipment_id].status = "AVAILABLE"
            self.data.equipment[loan.equipment_id].current_loan = None

            refund = loan.deposit - penalty
            if penalty > sp.mutez(0):
                sp.send(self.data.admin, penalty)
            if refund > sp.mutez(0):
                sp.send(loan.student, refund)

        @sp.entrypoint
        def reject_checkout(self, loan_id):
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert self.data.loans.contains(loan_id), "NO_SUCH_LOAN"

            loan = self.data.loans[loan_id]
            assert loan.status == "CHECKOUT_PENDING", "BAD_LOAN_STATE"

            self.data.loans[loan_id].status = "REJECTED"
            self.data.equipment[loan.equipment_id].status = "AVAILABLE"
            self.data.equipment[loan.equipment_id].current_loan = None
            if loan.deposit > sp.mutez(0):
                sp.send(loan.student, loan.deposit)

        @sp.entrypoint
        def cancel_request(self, loan_id):
            assert self.data.loans.contains(loan_id), "NO_SUCH_LOAN"

            loan = self.data.loans[loan_id]
            assert sp.sender == loan.student, "NOT_BORROWER"
            assert loan.status == "CHECKOUT_PENDING", "BAD_LOAN_STATE"

            self.data.loans[loan_id].status = "CANCELLED"
            self.data.equipment[loan.equipment_id].status = "AVAILABLE"
            self.data.equipment[loan.equipment_id].current_loan = None
            if loan.deposit > sp.mutez(0):
                sp.send(loan.student, loan.deposit)
@sp.add_test()
def test_opavolabs_core():
    scenario = sp.test_scenario("OpavoLabs Smart Contract", opavolabs)

    admin = sp.test_account("LabAdmin")
    student = sp.test_account("Student")
    other_student = sp.test_account("OtherStudent")

    contract = opavolabs.OpavoLabs(admin.address)
    scenario += contract

    deposit = sp.tez(5)
    checkout_hash = sp.bytes("0x" + "11" * 32)
    return_hash = sp.bytes("0x" + "22" * 32)

    scenario.h1("1. Admin registers equipment")
    contract.register_equipment(
        name="Oscilloscope",
        deposit=deposit,
        _sender=admin,
    )

    scenario.h1("2. Student requests checkout")
    contract.request_checkout(
        equipment_id=0,
        photo_cid="ipfs://checkout-photo-cid",
        photo_hash=checkout_hash,
        _sender=student,
        _amount=deposit,
    )

    scenario.h1("3. Admin approves checkout")
    contract.approve_checkout(
        loan_id=0,
        seen_hash=checkout_hash,
        _sender=admin,
    )

    scenario.h1("4. Unauthorized student attempts return")
    contract.request_return(
        loan_id=0,
        photo_cid="ipfs://unauthorized-return",
        photo_hash=return_hash,
        _sender=other_student,
        _valid=False,
        _exception="NOT_BORROWER",
    )

    scenario.h1("5. Actual borrower requests return")
    contract.request_return(
        loan_id=0,
        photo_cid="ipfs://return-photo-cid",
        photo_hash=return_hash,
        _sender=student,
    )

    scenario.h1("6. Admin approves return")
    contract.approve_return(
        loan_id=0,
        seen_hash=return_hash,
        penalty=sp.mutez(0),
        _sender=admin,
    )
