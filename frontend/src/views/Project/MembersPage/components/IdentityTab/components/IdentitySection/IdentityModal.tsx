import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form"; 
import Link from "next/link";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { useNotificationContext } from "@app/components/context/Notifications/NotificationProvider";
import {
    Button,
    FormControl,
    Modal,
    ModalContent,
    Select,
    SelectItem,
} from "@app/components/v2";
import {
    useOrganization,
    useWorkspace
} from "@app/context";
import { 
    useAddIdentityToWorkspace,
    useGetIdentityMembershipOrgs,
    useGetRoles,
    useGetWorkspaceIdentityMemberships
} from "@app/hooks/api";
import { UsePopUpState } from "@app/hooks/usePopUp";

const schema = yup.object({
    identityId: yup.string().required("Identity id is required"),
    role: yup.string()
}).required();

export type FormData = yup.InferType<typeof schema>;

type Props = {
  popUp: UsePopUpState<["identity"]>;
  handlePopUpToggle: (popUpName: keyof UsePopUpState<["identity"]>, state?: boolean) => void;
};

export const IdentityModal = ({
    popUp,
    handlePopUpToggle
}: Props) => {
    
    const { createNotification } = useNotificationContext();
    const { currentOrg } = useOrganization();
    const { currentWorkspace } = useWorkspace();

    const orgId = currentOrg?._id || "";
    const workspaceId = currentWorkspace?._id || "";
    
    const { data: identityMembershipOrgs } = useGetIdentityMembershipOrgs(orgId);
    const { data: identityMemberships } = useGetWorkspaceIdentityMemberships(workspaceId);

    const { data: roles } = useGetRoles({
        orgId,
        workspaceId
    });

    const { mutateAsync: addIdentityToWorkspaceMutateAsync } = useAddIdentityToWorkspace();
    
    const filteredIdentityMembershipOrgs = useMemo(() => {
        const wsIdentityIds = new Map();
        
        identityMemberships?.forEach((identityMembership) => {
            wsIdentityIds.set(identityMembership.identity._id, true);
        });
        
        return (identityMembershipOrgs || []).filter(
          ({ identity: i }) => !wsIdentityIds.has(i._id)
        );
    }, [identityMembershipOrgs, identityMemberships]);
    
    const {
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting }
    } = useForm<FormData>({
        resolver: yupResolver(schema)
    });
    
    const onFormSubmit = async ({
        identityId,
        role
    }: FormData) => {
        try {

            await addIdentityToWorkspaceMutateAsync({
                workspaceId,
                identityId,
                role: role || undefined
            });
            
            createNotification({
                text: "Successfully added identity to project",
                type: "success"
            });

            reset();
            handlePopUpToggle("identity", false);
        } catch (err) {
            console.error(err);
            const error = err as any;
            const text = error?.response?.data?.message
                ?? "Failed to add identity to project";
            
            createNotification({
                text,
                type: "error"
            });
        }
    }
    
    return (
        <Modal
            isOpen={popUp?.identity?.isOpen}
                onOpenChange={(isOpen) => {
                handlePopUpToggle("identity", isOpen);
                reset();
            }}
        >
            <ModalContent title="Add Identity to Project">
                {filteredIdentityMembershipOrgs.length ? (
                    <form onSubmit={handleSubmit(onFormSubmit)}>
                        <Controller
                            control={control}
                            name="identityId"
                            defaultValue={filteredIdentityMembershipOrgs?.[0]?._id}
                            render={({ field: { onChange, ...field }, fieldState: { error } }) => (
                                <FormControl
                                    label="Identity"
                                    errorText={error?.message}
                                    isError={Boolean(error)}
                                >
                                    <Select
                                        defaultValue={field.value}
                                        {...field}
                                        onValueChange={(e) => onChange(e)}
                                        className="w-full"
                                    >
                                        {filteredIdentityMembershipOrgs.map(({ identity }) => (
                                            <SelectItem value={identity._id} key={`org-identity-${identity._id}`}>
                                                {identity.name}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        />
                        <Controller
                            control={control}
                            name="role"
                            defaultValue=""
                            render={({ field: { onChange, ...field }, fieldState: { error } }) => (
                                <FormControl
                                    label="Role"
                                    errorText={error?.message}
                                    isError={Boolean(error)}
                                    className="mt-4"
                                >
                                    <Select
                                        defaultValue={field.value}
                                        {...field}
                                        onValueChange={(e) => onChange(e)}
                                        className="w-full"
                                    >
                                        {(roles || []).map(({ name, slug }) => (
                                            <SelectItem value={slug} key={`st-role-${slug}`}>
                                                {name}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        />
                        <div className="flex items-center">
                            <Button
                                className="mr-4"
                                size="sm"
                                type="submit"
                                isLoading={isSubmitting}
                                isDisabled={isSubmitting}
                            >
                                {popUp?.identity?.data ? "Update" : "Create"}
                            </Button>
                            <Button colorSchema="secondary" variant="plain">
                                Cancel
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="flex flex-col space-y-4">
                        <div>All identities in your organization are already added.</div>
                        <Link href={`/org/${currentWorkspace?.organization}/members`}>
                            <Button variant="outline_bg">Create a new/another identities</Button>
                        </Link>
                    </div>
                )}
            </ModalContent>
        </Modal>
    );
}